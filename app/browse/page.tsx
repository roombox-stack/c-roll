// /browse — Filterable, sortable index of everything on the platform.
//
// Server component: fetches the full dataset (entities + events + media
// aggregates), then hands it to a client component for filter/sort/toggle.
// No pagination for V1 — render everything.

import Image from 'next/image';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCount } from '@/components/format';
import type { EntityType } from '@/lib/types';
import { BrowseClient, type BrowseEntity, type BrowseEvent } from './browse-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Browse · c·roll',
  description: 'Every artist, team, event, and show on c·roll — filter and sort the full catalog.',
};

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

export default async function BrowsePage() {
  const supabase = createAdminClient();

  const [entitiesRes, eventsRes, mediaRes, mediaCountRes] = await Promise.all([
    supabase
      .from('entities')
      .select('id, slug, name, type, hero_image_url, follower_count'),

    supabase
      .from('events')
      .select('id, slug, venue_name, city, state, event_date, upload_count, entity_id')
      .order('event_date', { ascending: false }),

    // Pull lightweight media rows to compute contributor counts per event.
    // Dataset is small in V1 — if this becomes hot, we'd move to a denormalized
    // contributor_count column on events.
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

  // ── Aggregate per entity ──────────────────────────────────────────────────
  const entityAgg = new Map<string, { showCount: number; uploadCount: number; lastDate: string }>();
  for (const ev of eventsRaw) {
    const a = entityAgg.get(ev.entity_id) ?? { showCount: 0, uploadCount: 0, lastDate: '' };
    a.showCount += 1;
    a.uploadCount += ev.upload_count;
    if (ev.event_date > a.lastDate) a.lastDate = ev.event_date;
    entityAgg.set(ev.entity_id, a);
  }

  // ── Aggregate contributors per event ──────────────────────────────────────
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

  // ── Shape client payloads ─────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/5 bg-ink">
        <Image
          src="/hero-browse.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-right opacity-100"
          unoptimized
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 via-30% to-transparent to-50%" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-14 lg:pb-12 lg:pt-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
            // C·ROLL CATALOG
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,4rem)] font-black leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.7)]">
            Browse.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-gray-400">
            <span className="text-white">{formatCount(entities.length)}</span> artists, teams, and
            events. <span className="text-white">{formatCount(events.length)}</span> shows
            archived. <span className="text-white">{formatCount(totalClips)}</span> clips.
          </p>
        </div>
      </section>

      <BrowseClient entities={entities} events={events} />

      <Footer />
    </div>
  );
}
