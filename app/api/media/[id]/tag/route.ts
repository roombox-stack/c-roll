// POST /api/media/[id]/tag
//
// Community-source a song tag on a media item.
// - Validates the song exists in the event's setlist.
// - One tag per (media_id, session_token) — 409 if already tagged.
// - Only sets song_tag on the media row when it is currently null (never
//   overwrites manual or auto tags).
//
// Request:  { song_tag: string, session_token: string }
// Response: updated media row

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSessionToken } from '@/lib/session';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const mediaId = params.id;
  if (!mediaId) {
    return NextResponse.json({ error: 'mediaId required' }, { status: 400 });
  }

  let body: { song_tag?: unknown; session_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { song_tag, session_token } = body;
  if (typeof song_tag !== 'string' || !song_tag.trim()) {
    return NextResponse.json({ error: 'song_tag required' }, { status: 400 });
  }
  if (!isValidSessionToken(session_token)) {
    return NextResponse.json({ error: 'session_token required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch the media row with its event's setlist.
  const { data: media, error: mediaErr } = await supabase
    .from('media')
    .select('id, status, song_tag, event_id, events(setlist)')
    .eq('id', mediaId)
    .single();

  if (mediaErr || !media) {
    return NextResponse.json({ error: 'media not found' }, { status: 404 });
  }
  if (media.status !== 'active') {
    return NextResponse.json({ error: 'media not active' }, { status: 409 });
  }

  // Validate song exists in event setlist.
  const rawSetlist = ((media.events as unknown) as { setlist: unknown } | null)?.setlist;
  const setlist: string[] = Array.isArray(rawSetlist)
    ? rawSetlist.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];

  const normalise = (s: string) => s.trim().toLowerCase();
  const tagNorm = normalise(song_tag);
  const matchedSong = setlist.find((s) => normalise(s) === tagNorm);
  if (!matchedSong) {
    return NextResponse.json({ error: 'song not in setlist' }, { status: 422 });
  }

  // Insert into community_tags — unique constraint on (media_id, session_token).
  const { error: insertErr } = await supabase.from('community_tags').insert({
    media_id: mediaId,
    session_token,
    song_tag: matchedSong,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'already tagged' }, { status: 409 });
    }
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  // Update media.song_tag only when currently null.
  const { data: updated, error: updateErr } = await supabase
    .from('media')
    .update({ song_tag: matchedSong, song_tag_source: 'community' })
    .eq('id', mediaId)
    .is('song_tag', null)
    .select('id, song_tag, song_tag_source')
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }

  // If updated is null the media row already had a tag — that's fine, return current state.
  if (!updated) {
    const { data: current } = await supabase
      .from('media')
      .select('id, song_tag, song_tag_source')
      .eq('id', mediaId)
      .single();
    return NextResponse.json(current);
  }

  return NextResponse.json(updated);
}
