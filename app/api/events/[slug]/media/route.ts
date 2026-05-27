// GET /api/events/[slug]/media
//
// Cursor-based paginated media for the event Browse tab.
// The server component fetches the first page; the client fetches subsequent
// pages using the nextCursor returned from the previous response.
//
// Query params:
//   cursor   — opaque string returned as nextCursor from a previous call
//   filter   — "photos" | "videos" | omit for all
//   section  — any valid section_tag value | omit for all
//   limit    — page size, max 48, default 24
//
// Response: { items: MediaCardData[], nextCursor: string | null }
//
// Cursor encoding: base64(JSON({ created_at, id })) — stable for the
// created_at DESC, id DESC ordering we use everywhere.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SECTION_ORDER } from '@/lib/types';

const PAGE_SIZE = 24;
const MAX_SIZE = 48;

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ created_at: createdAt, id })).toString('base64url');
}

function decodeCursor(c: string): { created_at: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const sp = req.nextUrl.searchParams;
  const cursorRaw = sp.get('cursor') ?? '';
  const filter = sp.get('filter') ?? '';
  const section = sp.get('section') ?? '';
  const limitRaw = parseInt(sp.get('limit') ?? String(PAGE_SIZE), 10);
  const limit = Math.min(isNaN(limitRaw) ? PAGE_SIZE : limitRaw, MAX_SIZE);

  const supabase = createAdminClient();

  // Resolve event by slug.
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id')
    .eq('slug', params.slug)
    .single();
  if (evErr || !event) {
    return NextResponse.json({ error: 'event not found' }, { status: 404 });
  }

  let query = supabase
    .from('media')
    .select(
      'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, section_tag, caption, view_count, like_count, is_full_song, uploader_id, upload_session, created_at',
    )
    .eq('event_id', event.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1); // fetch one extra to know if there's a next page

  if (filter === 'photos') query = query.eq('file_type', 'photo');
  if (filter === 'videos') query = query.eq('file_type', 'video');
  if (section && (SECTION_ORDER as string[]).includes(section)) {
    query = query.eq('section_tag', section);
  }

  if (cursorRaw) {
    const cursor = decodeCursor(cursorRaw);
    if (cursor) {
      // Items strictly before the cursor position (older).
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeCursor(lastItem.created_at as string, lastItem.id as string)
      : null;

  return NextResponse.json({ items, nextCursor });
}
