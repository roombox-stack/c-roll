// POST /api/upload/video-url
//
// Creates a Mux direct upload and a corresponding `media` row in
// status = 'uploading'. The client PUTs the raw video file to `uploadUrl`.
// Mux processes asynchronously and posts `video.asset.ready` to our webhook,
// at which point the media row gets its playback_id + thumbnail and flips to
// 'active'.
//
// Note: at this point we have a Mux *upload* ID, not an *asset* ID. The asset
// ID is created by Mux after processing and is delivered via webhook.
//
// Request:  { eventId: string, sessionToken?: string, filename?: string }
// Response: { mediaId: string, uploadUrl: string, muxUploadId: string }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDirectUpload } from '@/lib/mux';
import { isValidSessionToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  let body: { eventId?: unknown; sessionToken?: unknown; filename?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const eventId = body.eventId;
  const sessionToken = body.sessionToken;

  if (typeof eventId !== 'string' || !eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }
  if (sessionToken !== undefined && !isValidSessionToken(sessionToken)) {
    return NextResponse.json({ error: 'invalid sessionToken' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, entity_id')
    .eq('id', eventId)
    .single();

  if (eventErr || !event) {
    return NextResponse.json({ error: 'event not found' }, { status: 404 });
  }

  // Create the Mux direct upload first — if this fails we don't want an
  // orphan media row.
  let mux: { uploadId: string; uploadUrl: string };
  try {
    mux = await createDirectUpload();
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown';
    console.error('[video-url] mux createDirectUpload failed:', detail, e);
    return NextResponse.json(
      { error: 'failed to create mux upload', detail },
      { status: 502 },
    );
  }

  const { data: media, error: insertErr } = await supabase
    .from('media')
    .insert({
      event_id: event.id,
      entity_id: event.entity_id,
      file_type: 'video',
      storage_url: '', // populated by the Mux webhook with the HLS URL
      mux_upload_id: mux.uploadId,
      upload_session: (sessionToken as string | undefined) ?? null,
      status: 'uploading',
    })
    .select('id')
    .single();

  if (insertErr || !media) {
    return NextResponse.json({ error: 'failed to create media row' }, { status: 500 });
  }

  return NextResponse.json({
    mediaId: media.id,
    uploadUrl: mux.uploadUrl,
    muxUploadId: mux.uploadId,
  });
}
