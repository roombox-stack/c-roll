// POST /api/media/[id]/tag
//
// Community-source a song tag on a media item.
// - Validates the song exists in the event's setlist.
// - One tag per (media_id, session_token) — 409 if already tagged.
//   community_tags provides abuse prevention; if the table doesn't exist yet
//   (migration pending) we skip the gate and continue.
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

  // Fetch the media row, then fetch the event setlist separately to avoid
  // ambiguity with how PostgREST returns joined rows (object vs. array).
  const { data: media, error: mediaErr } = await supabase
    .from('media')
    .select('id, status, song_tag, event_id')
    .eq('id', mediaId)
    .single();

  if (mediaErr || !media) {
    return NextResponse.json({ error: 'media not found' }, { status: 404 });
  }
  if (media.status !== 'active') {
    return NextResponse.json({ error: 'media not active' }, { status: 409 });
  }

  // Fetch the event setlist.
  const { data: eventRow } = await supabase
    .from('events')
    .select('setlist')
    .eq('id', (media as unknown as { event_id: string }).event_id)
    .single();

  const rawSetlist = (eventRow as unknown as { setlist: unknown } | null)?.setlist;
  const setlist: string[] = Array.isArray(rawSetlist)
    ? rawSetlist.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];

  const normalise = (s: string) => s.trim().toLowerCase();
  const tagNorm = normalise(song_tag);
  const matchedSong = setlist.find((s) => normalise(s) === tagNorm);
  if (!matchedSong) {
    return NextResponse.json({ error: 'song not in setlist' }, { status: 422 });
  }

  // Insert into community_tags for abuse prevention.
  // PGRST205 = table not in schema cache (migration not yet applied) — skip the gate.
  // 23505     = unique violation (session already tagged this clip) — return 409.
  const { error: insertErr } = await supabase.from('community_tags').insert({
    media_id: mediaId,
    session_token,
    song_tag: matchedSong,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'already tagged' }, { status: 409 });
    }
    // Any error other than "table missing" is unexpected — bail out.
    const tableMissing =
      insertErr.code === 'PGRST205' ||
      insertErr.message?.includes('community_tags') ||
      insertErr.message?.includes('42P01');
    if (!tableMissing) {
      return NextResponse.json({ error: 'insert failed' }, { status: 500 });
    }
    // Table not yet created — fall through and still apply the tag.
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

  // If updated is null the media row already had a tag — return current state.
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
