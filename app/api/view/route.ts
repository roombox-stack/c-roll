// POST /api/view
//
// Register a view of a media item for view-count dedup. First view per
// (media, session) inserts a row in media_views and the trigger bumps
// media.view_count by 1. Repeat calls are silently ignored (idempotent).
//
// Request:  { mediaId: string, sessionToken: string }
// Response: { counted: boolean, viewCount: number }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSessionToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  let body: { mediaId?: unknown; sessionToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const mediaId = body.mediaId;
  if (typeof mediaId !== 'string' || !mediaId) {
    return NextResponse.json({ error: 'mediaId required' }, { status: 400 });
  }
  if (!isValidSessionToken(body.sessionToken)) {
    return NextResponse.json({ error: 'sessionToken required' }, { status: 400 });
  }
  const sessionToken = body.sessionToken;

  const supabase = createAdminClient();

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

  // Race-safe insert: unique constraint absorbs a concurrent duplicate.
  const { error: insertErr } = await supabase
    .from('media_views')
    .insert({ media_id: mediaId, session_token: sessionToken });

  let counted = true;
  if (insertErr) {
    // 23505 = unique_violation → already viewed by this session
    if ((insertErr as { code?: string }).code === '23505') {
      counted = false;
    } else {
      return NextResponse.json({ error: 'view failed' }, { status: 500 });
    }
  }

  const { data: refreshed } = await supabase
    .from('media')
    .select('view_count')
    .eq('id', mediaId)
    .single();

  return NextResponse.json({
    counted,
    viewCount: refreshed?.view_count ?? 0,
  });
}
