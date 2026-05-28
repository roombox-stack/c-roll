// Shared server-side data loader for /browse and its pre-filtered variants
// (/artists, /sports). Returns everything BrowseClient needs.

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { EntityType } from '@/lib/types';
import type { BrowseEntity, BrowseEvent } from '@/app/browse/browse-client';

interface EntityFromDB {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  hero_image_url: string | null;
  follower_count: number;
}

interface EventFromDB {
  id: string;
  slug: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  upload_count: number;
  entity_id: string;
}

interface MediaFromDB {
  event_id: string;
  uploader_id: string | null;
  upload_session: string | null;
}

export interface BrowseDataset {
  entities: BrowseEntity[];
  events: BrowseEvent[];
  totalClips: number;
  isAuthed: boolean;
  followingSlugs: string[];
}

export async function loadBrowseDataset(): Promise<BrowseDataset> {
  const supabase = createAdminClient();

  const [entitiesRes, eventsRes, mediaRes, mediaCountRes] = await Promise.all([
    supabase
      .from('entities')
      .select('id, slug, name, type, hero_image_url, follower_count'),
    supabase
      .from('events')
      .select('id, slug, venue_name, city, state, event_date, upload_count, entity_id')
      .order('event_date', { ascending: false }),
    supabase
      .from('media')
      .select('event_id, uploader_id, upload_session')
      .eq('status', 'active'),
    supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
  ]);

  const entitiesRaw = (entitiesRes.data ?? []) as EntityFromDB[];
  const eventsRaw = (eventsRes.data ?? []) as EventFromDB[];
  const mediaRaw = (mediaRes.data ?? []) as MediaFromDB[];
  const totalClips = mediaCountRes.count ?? 0;

  const currentUser = await getCurrentUser();
  const followingSlugs: string[] = [];
  if (currentUser) {
    const { data: followsData } = await supabase
      .from('follows')
      .select('entity_id')
      .eq('user_id', currentUser.id);
    const followedIds = new Set(
      (followsData ?? []).map((r) => (r as { entity_id: string }).entity_id),
    );
    for (const e of entitiesRaw) {
      if (followedIds.has(e.id)) followingSlugs.push(e.slug);
    }
  }

  const entityAgg = new Map<
    string,
    { showCount: number; uploadCount: number; lastDate: string }
  >();
  for (const ev of eventsRaw) {
    const a =
      entityAgg.get(ev.entity_id) ?? { showCount: 0, uploadCount: 0, lastDate: '' };
    a.showCount += 1;
    a.uploadCount += ev.upload_count;
    if (ev.event_date > a.lastDate) a.lastDate = ev.event_date;
    entityAgg.set(ev.entity_id, a);
  }

  const eventContribs = new Map<string, Set<string>>();
  for (const m of mediaRaw) {
    const key = m.uploader_id
      ? `u:${m.uploader_id}`
      : m.upload_session
        ? `s:${m.upload_session}`
        : null;
    if (!key) continue;
    const set = eventContribs.get(m.event_id) ?? new Set<string>();
    set.add(key);
    eventContribs.set(m.event_id, set);
  }

  const entityMap = new Map(entitiesRaw.map((e) => [e.id, e]));

  const entities: BrowseEntity[] = entitiesRaw.map((e) => {
    const a = entityAgg.get(e.id);
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      type: e.type,
      hero_image_url: e.hero_image_url,
      follower_count: e.follower_count,
      show_count: a?.showCount ?? 0,
      upload_count: a?.uploadCount ?? 0,
      last_event_date: a?.lastDate || null,
    };
  });

  const events: BrowseEvent[] = eventsRaw.map((ev) => {
    const ent = entityMap.get(ev.entity_id);
    return {
      id: ev.id,
      slug: ev.slug,
      venue_name: ev.venue_name,
      city: ev.city,
      state: ev.state,
      event_date: ev.event_date,
      upload_count: ev.upload_count,
      contributor_count: eventContribs.get(ev.id)?.size ?? 0,
      entity: ent ? { slug: ent.slug, name: ent.name } : null,
    };
  });

  return {
    entities,
    events,
    totalClips,
    isAuthed: !!currentUser,
    followingSlugs,
  };
}
