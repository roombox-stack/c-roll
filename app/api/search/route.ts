// GET /api/search?q=<term>
//
// Returns up to 5 matching entities and 5 matching events. Entities are
// matched by name/slug; events by venue_name/city plus any event whose entity
// itself matched. Results are JSON: { entities: [...], events: [...] }.
//
// V1 uses simple ilike substring matching — fast and good enough until the
// catalog grows. Special characters that would break the PostgREST OR filter
// are stripped from the query.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX = 5;
const ENTITY_FIELDS = 'id, slug, name, type, follower_count, hero_image_url';
const EVENT_FIELDS =
  'id, slug, name, venue_name, city, state, event_date, upload_count, ' +
  'entity:entities(id, slug, name, type)';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  // Strip chars that would break PostgREST OR / in() / ilike syntax.
  const safe = raw.replace(/[\\%_,()]/g, '');
  if (!safe) {
    return NextResponse.json({ entities: [], events: [] });
  }
  const pattern = `%${safe}%`;
  const supabase = createAdminClient();

  // 1) Entities
  const { data: entities, error: entErr } = await supabase
    .from('entities')
    .select(ENTITY_FIELDS)
    .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    .order('follower_count', { ascending: false })
    .limit(MAX);
  if (entErr) {
    return NextResponse.json({ error: 'entity search failed' }, { status: 500 });
  }

  const entityIds = (entities ?? []).map((e) => e.id);

  // 2) Events — by place and (if we matched any entities) by entity_id.
  // Run both in parallel then merge/dedupe.
  const [byPlace, byEntity] = await Promise.all([
    supabase
      .from('events')
      .select(EVENT_FIELDS)
      .or(`venue_name.ilike.${pattern},city.ilike.${pattern}`)
      .order('event_date', { ascending: false })
      .limit(MAX),
    entityIds.length
      ? supabase
          .from('events')
          .select(EVENT_FIELDS)
          .in('entity_id', entityIds)
          .order('event_date', { ascending: false })
          .limit(MAX)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
  ]);

  if (byPlace.error || byEntity.error) {
    return NextResponse.json({ error: 'event search failed' }, { status: 500 });
  }

  // Embedded selects make the inferred type a union with PostgREST's error
  // shape — cast to a minimal shape for dedup. Errors are surfaced above.
  type EventRow = { id: string } & Record<string, unknown>;
  const seen = new Map<string, EventRow>();
  for (const e of (byPlace.data ?? []) as unknown as EventRow[]) seen.set(e.id, e);
  for (const e of (byEntity.data ?? []) as unknown as EventRow[]) {
    if (!seen.has(e.id)) seen.set(e.id, e);
  }
  const events = Array.from(seen.values()).slice(0, MAX);

  return NextResponse.json({
    entities: entities ?? [],
    events,
  });
}
