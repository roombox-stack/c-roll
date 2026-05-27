// PATCH /api/admin/media/[id]
//
// Admin-only endpoint for editing a single media row's song_tag. Auth is
// handled by middleware.ts (gates all /api/admin/*) — no in-route check
// required.
//
// Request:  { song_tag: string | null }
// Response: the updated media row (200) or { error } (400/500)

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_SONG_TAG = 120;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: { song_tag?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const raw = body.song_tag;
  let songTag: string | null;
  if (raw === null) {
    songTag = null;
  } else if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) {
      songTag = null;
    } else if (t.length > MAX_SONG_TAG) {
      return NextResponse.json(
        { error: `song_tag exceeds ${MAX_SONG_TAG} chars` },
        { status: 400 },
      );
    } else {
      songTag = t;
    }
  } else {
    return NextResponse.json(
      { error: 'song_tag must be string or null' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('media')
    .update({ song_tag: songTag })
    .eq('id', params.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'media not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
