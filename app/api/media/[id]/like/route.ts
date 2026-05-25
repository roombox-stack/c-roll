// POST /api/media/[id]/like
//
// Toggle a like on a media item. Anonymous users send a `sessionToken` and the
// row is keyed on (media_id, session_token) via a partial unique index.
// Authenticated users are not wired in V1 — that lands when the sign-in route
// ships; the schema's `unique(media_id, user_id)` covers them already.
//
// Semantics (confirmed): repeat call on a media item the session already liked
// returns `{ liked: false, ... }` — i.e. toggle, not add-only.
//
// Request:  { sessionToken: string }
// Response: { liked: boolean, likeCount: number }

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

  let body: { sessionToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const sessionToken = body.sessionToken;
  if (!isValidSessionToken(sessionToken)) {
    return NextResponse.json({ error: 'sessionToken required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Confirm the media row exists and is active. Liking a removed item is a no-op.
  const { data: media, error: mediaErr } = await supabase
    .from('media')
    .select('id, status')
    .eq('id', mediaId)
    .single();
  if (mediaErr || !media) {
    return NextResponse.json({ error: 'media not found' }, { status: 404 });
  }
  if (media.status !== 'active') {
    return NextResponse.json({ error: 'media not active' }, { status: 409 });
  }

  // Find an existing anon like for this (media, session).
  const { data: existing, error: lookupErr } = await supabase
    .from('likes')
    .select('id')
    .eq('media_id', mediaId)
    .eq('session_token', sessionToken)
    .is('user_id', null)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  let liked: boolean;
  if (existing) {
    const { error } = await supabase.from('likes').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: 'unlike failed' }, { status: 500 });
    liked = false;
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ media_id: mediaId, session_token: sessionToken });
    if (error) {
      // Could be a race with another concurrent like; treat as already-liked.
      return NextResponse.json({ error: 'like failed' }, { status: 500 });
    }
    liked = true;
  }

  // Re-read the now-updated count (trigger fired in the same transaction).
  const { data: refreshed } = await supabase
    .from('media')
    .select('like_count')
    .eq('id', mediaId)
    .single();

  return NextResponse.json({
    liked,
    likeCount: refreshed?.like_count ?? 0,
  });
}
