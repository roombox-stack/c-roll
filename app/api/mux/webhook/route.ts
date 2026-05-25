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
import { MUX_WEBHOOK_SECRET, muxThumbnailUrl } from '@/lib/mux';

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

    const { error } = await supabase
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
      .eq('mux_upload_id', uploadId);

    if (error) {
      // Surface as 500 so Mux retries.
      return NextResponse.json({ error: 'failed to update media' }, { status: 500 });
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
