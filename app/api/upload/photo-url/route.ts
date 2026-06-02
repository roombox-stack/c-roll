// POST /api/upload/photo-url
//
// Issues a Cloudflare R2 presigned PUT URL for a photo upload and creates the
// corresponding `media` row in `status = 'uploading'`. The client then PUTs the
// file directly to R2. Once the upload completes, the client calls
// /api/upload/complete which applies tags and flips status → 'active'.
//
// Request:  { filename: string, contentType: string, eventId: string, sessionToken?: string }
// Response: { mediaId: string, uploadUrl: string, storageUrl: string }
// Errors:   400 on bad input, 404 if event not found, 415 on disallowed content type.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ALLOWED_PHOTO_TYPES,
  createPhotoUploadUrl,
  photoKey,
  publicUrlForKey,
} from '@/lib/r2';
import { isValidSessionToken } from '@/lib/session';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let body: { filename?: unknown; contentType?: unknown; eventId?: unknown; sessionToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const filename = body.filename;
  const contentType = body.contentType;
  const eventId = body.eventId;
  const sessionToken = body.sessionToken;

  if (typeof filename !== 'string' || !filename.trim()) {
    return NextResponse.json({ error: 'filename required' }, { status: 400 });
  }
  if (typeof contentType !== 'string' || !ALLOWED_PHOTO_TYPES.has(contentType.toLowerCase())) {
    return NextResponse.json(
      { error: `unsupported content type: ${contentType}` },
      { status: 415 },
    );
  }
  if (typeof eventId !== 'string' || !eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }
  if (sessionToken !== undefined && !isValidSessionToken(sessionToken)) {
    return NextResponse.json({ error: 'invalid sessionToken' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const currentUser = await getCurrentUser();

  // Look up the event so we can fill entity_id on the media row.
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, entity_id')
    .eq('id', eventId)
    .single();

  if (eventErr || !event) {
    return NextResponse.json({ error: 'event not found' }, { status: 404 });
  }

  // Generate the media row first so we can use its UUID in the R2 key.
  const { data: media, error: insertErr } = await supabase
    .from('media')
    .insert({
      event_id: event.id,
      entity_id: event.entity_id,
      file_type: 'photo',
      storage_url: '', // filled below after key is built
      uploader_id: currentUser?.id ?? null,
      upload_session: (sessionToken as string | undefined) ?? null,
      status: 'uploading',
    })
    .select('id')
    .single();

  if (insertErr || !media) {
    return NextResponse.json({ error: 'failed to create media row' }, { status: 500 });
  }

  const key = photoKey(event.id, media.id, filename);
  const storageUrl = publicUrlForKey(key);

  // Update the row with the resolved storage URL.
  const { error: updateErr } = await supabase
    .from('media')
    .update({ storage_url: storageUrl })
    .eq('id', media.id);
  if (updateErr) {
    return NextResponse.json({ error: 'failed to set storage_url' }, { status: 500 });
  }

  let uploadUrl: string;
  try {
    uploadUrl = await createPhotoUploadUrl({ key, contentType: contentType.toLowerCase() });
  } catch (e) {
    return NextResponse.json({ error: 'failed to sign upload URL' }, { status: 500 });
  }

  return NextResponse.json({
    mediaId: media.id,
    uploadUrl,
    storageUrl,
  });
}
