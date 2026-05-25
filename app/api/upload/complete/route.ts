// POST /api/upload/complete
//
// Called by the client after a successful PUT to R2 (photos) or Mux (videos).
// Applies optional tags and, for photos, flips status uploading → active so
// the upload becomes publicly visible and counters fire via DB trigger.
// For videos, status stays 'uploading' until the Mux webhook delivers the
// playback_id.
//
// Ownership check: sessionToken must match the row's `upload_session` (anon
// path). Authenticated uploads are not yet wired through this route — V1 ships
// the anon path; auth claim happens later via /api/account/claim-session.
//
// Request:
//   { mediaId, sessionToken, songTag?, sectionTag?, caption? }
// Response:
//   { ok: true, status: 'uploading' | 'active' }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSessionToken } from '@/lib/session';
import { SECTION_ORDER, type SectionTag } from '@/lib/types';

const SECTION_SET = new Set<SectionTag>(SECTION_ORDER);
const MAX_CAPTION = 140;

export async function POST(req: NextRequest) {
  let body: {
    mediaId?: unknown;
    sessionToken?: unknown;
    songTag?: unknown;
    sectionTag?: unknown;
    caption?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { mediaId, sessionToken, songTag, sectionTag, caption } = body;

  if (typeof mediaId !== 'string' || !mediaId) {
    return NextResponse.json({ error: 'mediaId required' }, { status: 400 });
  }
  if (!isValidSessionToken(sessionToken)) {
    return NextResponse.json({ error: 'sessionToken required' }, { status: 400 });
  }
  if (songTag !== undefined && songTag !== null && typeof songTag !== 'string') {
    return NextResponse.json({ error: 'songTag must be string' }, { status: 400 });
  }
  if (sectionTag !== undefined && sectionTag !== null) {
    if (typeof sectionTag !== 'string' || !SECTION_SET.has(sectionTag as SectionTag)) {
      return NextResponse.json({ error: 'invalid sectionTag' }, { status: 400 });
    }
  }
  if (caption !== undefined && caption !== null) {
    if (typeof caption !== 'string') {
      return NextResponse.json({ error: 'caption must be string' }, { status: 400 });
    }
    if (caption.length > MAX_CAPTION) {
      return NextResponse.json(
        { error: `caption exceeds ${MAX_CAPTION} chars` },
        { status: 400 },
      );
    }
  }

  const supabase = createAdminClient();

  const { data: media, error: fetchErr } = await supabase
    .from('media')
    .select('id, file_type, status, upload_session')
    .eq('id', mediaId)
    .single();
  if (fetchErr || !media) {
    return NextResponse.json({ error: 'media not found' }, { status: 404 });
  }

  if (media.upload_session !== sessionToken) {
    return NextResponse.json({ error: 'session mismatch' }, { status: 403 });
  }
  if (media.status !== 'uploading') {
    return NextResponse.json(
      { error: `cannot complete: status is ${media.status}` },
      { status: 409 },
    );
  }

  // Build the update payload. Photos flip to active; videos wait for the Mux
  // webhook (which sets playback_id + thumbnail before flipping).
  const update: Record<string, unknown> = {};
  if (typeof songTag === 'string') update.song_tag = songTag.trim() || null;
  if (typeof sectionTag === 'string') update.section_tag = sectionTag;
  if (typeof caption === 'string') update.caption = caption.trim() || null;
  if (media.file_type === 'photo') update.status = 'active';

  const { error: updateErr } = await supabase
    .from('media')
    .update(update)
    .eq('id', media.id);
  if (updateErr) {
    return NextResponse.json({ error: 'failed to update media' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: media.file_type === 'photo' ? 'active' : 'uploading',
  });
}
