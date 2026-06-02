// POST /api/mux/webhook
//
// Receives Mux webhooks. We verify the `Mux-Signature` header via HMAC-SHA256
// and act on the events we care about:
//
//   video.asset.ready     — set playback_id, thumbnail, duration, HLS url, status=active
//   video.asset.errored   — mark the media row as 'removed' so it doesn't dangle
//
// The media row is correlated to the Mux upload via `mux_upload_id` (set by
// /api/upload/video-url).
//
// Signature algorithm (per https://docs.mux.com/guides/system/listen-for-webhooks):
//   header  : Mux-Signature: t=<unix-ts>,v1=<hex-hmac-sha256>
//   payload : `${unixTs}.${rawJsonBody}`
//   secret  : MUX_WEBHOOK_SECRET
// We reject events older than 5 minutes to stop replay attacks.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMux, MUX_WEBHOOK_SECRET, muxThumbnailUrl } from '@/lib/mux';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

async function autoTagFromAudd(mediaId: string, muxAssetId: string, eventId: string) {
  const token = process.env.AUDD_API_TOKEN;
  if (!token) return;

  const supabase = createAdminClient();

  // Fetch event setlist
  const { data: event } = await supabase
    .from('events')
    .select('setlist')
    .eq('id', eventId)
    .single();

  const setlist: string[] = event?.setlist ?? [];
  if (setlist.length === 0) return;

  // Get a temporary master access URL from Mux
  const mux = getMux();
  let asset = await mux.video.assets.retrieve(muxAssetId);

  if (asset.master_access !== 'temporary') {
    await mux.video.assets.updateMasterAccess(muxAssetId, { master_access: 'temporary' });
  }

  let masterUrl: string | undefined;
  const MAX_ATTEMPTS = 10;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    asset = await mux.video.assets.retrieve(muxAssetId);
    masterUrl = asset.master?.url;
    if (masterUrl) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  if (!masterUrl) return;

  // Download only the first 8 MB so we stay within AudD's file size limit
  const chunkRes = await fetch(masterUrl, { headers: { Range: 'bytes=0-8388607' } });
  if (!chunkRes.ok && chunkRes.status !== 206) return;
  const audioBlob = await chunkRes.blob();

  const form = new FormData();
  form.append('api_token', token);
  form.append('file', audioBlob, 'audio.mp4');
  form.append('return', 'timecode');

  const res = await fetch('https://api.audd.io/', { method: 'POST', body: form });
  if (!res.ok) return;

  const json = await res.json() as { status?: string; result?: { title?: string } };
  if (json.status !== 'success' || !json.result?.title) return;

  const detectedNorm = normalize(json.result.title);
  const match = setlist.find((song) => normalize(song) === detectedNorm);
  if (!match) return;

  // Only write if song_tag is null and source is not manual
  await supabase
    .from('media')
    .update({ song_tag: match, song_tag_source: 'auto' })
    .eq('id', mediaId)
    .is('song_tag', null);
}

function fireAndForget(mediaId: string, muxAssetId: string, eventId: string) {
  autoTagFromAudd(mediaId, muxAssetId, eventId).catch((err: unknown) => {
    console.error('[audd] auto-tag failed', err);
  });
}

// Webhook handlers must read the raw bytes. Disable static optimization.
export const dynamic = 'force-dynamic';

const TIMESTAMP_TOLERANCE_SEC = 5 * 60;

function verifyMuxSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;

  // Parse "t=...,v1=..."
  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const [k, v] = piece.trim().split('=', 2);
    if (k && v) parts[k] = v;
  }
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  // Reject events outside the freshness window.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > TIMESTAMP_TOLERANCE_SEC) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex');

  // Lengths must match for timingSafeEqual; bail out cleanly if not.
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

interface MuxEvent {
  type: string;
  data?: {
    id?: string;
    upload_id?: string;
    duration?: number;
    playback_ids?: Array<{ id: string; policy?: string }>;
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sigHeader = req.headers.get('mux-signature');

  if (!verifyMuxSignature(rawBody, sigHeader, MUX_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: MuxEvent;
  try {
    event = JSON.parse(rawBody) as MuxEvent;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const type = event.type;
  const data = event.data ?? {};
  const supabase = createAdminClient();

  if (type === 'video.asset.ready') {
    const uploadId = data.upload_id;
    const assetId = data.id;
    const playbackId = data.playback_ids?.[0]?.id;
    const duration = data.duration;

    if (!uploadId || !assetId || !playbackId) {
      // Unexpected but don't 500 — Mux will retry indefinitely on non-2xx.
      return NextResponse.json({ ok: true, note: 'missing required fields' });
    }

    // Full-song heuristic: ≥ 150 seconds means the upload likely captures a
    // complete song (verses + chorus arc). Mux reports duration in seconds.
    const isFullSong = typeof duration === 'number' && duration >= 150;

    const { data: updatedRows, error } = await supabase
      .from('media')
      .update({
        mux_asset_id: assetId,
        mux_playback_id: playbackId,
        thumbnail_url: muxThumbnailUrl(playbackId, { width: 640 }),
        duration_sec: duration != null ? Math.round(duration) : null,
        storage_url: `https://stream.mux.com/${playbackId}.m3u8`,
        is_full_song: isFullSong,
        status: 'active',
      })
      .eq('mux_upload_id', uploadId)
      .select('id, event_id');

    if (error) {
      // Surface as 500 so Mux retries.
      return NextResponse.json({ error: 'failed to update media' }, { status: 500 });
    }

    const row = updatedRows?.[0];
    if (row?.id && row?.event_id) {
      fireAndForget(row.id as string, assetId, row.event_id as string);
    }
  } else if (type === 'video.asset.errored') {
    const uploadId = data.upload_id;
    if (uploadId) {
      await supabase.from('media').update({ status: 'removed' }).eq('mux_upload_id', uploadId);
    }
  }
  // All other event types: ack and ignore.

  return NextResponse.json({ ok: true });
}
