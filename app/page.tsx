// / — Home discovery feed for non-attendees.
//
// Sections (top-to-bottom):
//   1. Featured clip (top-viewed active video; labeled "Featured" — using
//      cumulative view_count since we punted on weekly tracking for V1)
//   2. Trending — horizontal scroll of top videos by view_count
//   3. Most uploaded shows — 4 events by upload_count
//   4. Browse by type — entity grid filterable by ?type= pill

import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { MediaCard, type MediaCardData } from '@/components/media-card';
import { EntityCard, type EntityCardData } from '@/components/entity-card';
import { EventCard, type EventCardData } from '@/components/event-card';
import { VideoPlayer } from '@/components/video-player';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const TYPE_PILLS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'artist', label: 'Music' },
  { value: 'team', label: 'Sports' },
  { value: 'event_brand', label: 'Events' },
];

const KNOWN_TYPES = new Set(['artist', 'team', 'event_brand', 'venue']);

interface FeaturedMedia extends MediaCardData {
  mux_playback_id: string | null;
  event: {
    name: string;
    venue_name: string;
    city: string;
    entity: { slug: string; name: string } | { slug: string; name: string }[];
  } | null;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const supabase = createAdminClient();
  const typeFilter = searchParams.type ?? '';

  let entitiesQuery = supabase
    .from('entities')
    .select('id, slug, name, type, follower_count, hero_image_url')
    .order('follower_count', { ascending: false })
    .limit(12);
  if (KNOWN_TYPES.has(typeFilter)) entitiesQuery = entitiesQuery.eq('type', typeFilter);

  const [featuredRes, trendingRes, topEventsRes, entitiesRes] = await Promise.all([
    supabase
      .from('media')
      .select(
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, caption, view_count, like_count, is_full_song, event:events(name, venue_name, city, entity:entities(slug, name))',
      )
      .eq('status', 'active')
      .eq('file_type', 'video')
      .not('mux_playback_id', 'is', null)
      .order('view_count', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('media')
      .select(
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, caption, view_count, like_count, is_full_song, event:events(name, city)',
      )
      .eq('status', 'active')
      .order('view_count', { ascending: false })
      .limit(8),

    supabase
      .from('events')
      .select(
        'id, slug, name, venue_name, city, state, event_date, upload_count, entity:entities(slug, name)',
      )
      .order('upload_count', { ascending: false })
      .limit(4),

    entitiesQuery,
  ]);

  const featured = featuredRes.data as unknown as FeaturedMedia | null;
  const trending = (trendingRes.data ?? []) as unknown as MediaCardData[];
  const topEvents = (topEventsRes.data ?? []) as unknown as Array<
    EventCardData & { entity: { slug: string; name: string } | { slug: string; name: string }[] }
  >;
  const entities = (entitiesRes.data ?? []) as unknown as EntityCardData[];

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-8">
        {featured?.mux_playback_id ? <FeaturedClip media={featured} /> : null}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Trending
          </h2>
          {trending.length === 0 ? (
            <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
              Nothing yet — be the first to upload.
            </p>
          ) : (
            <div className="grid auto-cols-[220px] grid-flow-col gap-3 overflow-x-auto pb-2">
              {trending.map((m) => (
                <MediaCard key={m.id} media={m} size="sm" showEventLabel />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Most uploaded shows
          </h2>
          {topEvents.length === 0 ? (
            <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
              No shows yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topEvents.map((ev) => {
                const ent = Array.isArray(ev.entity) ? ev.entity[0] : ev.entity;
                return (
                  <EventCard
                    key={ev.id}
                    showEntityName
                    event={{
                      id: ev.id,
                      slug: ev.slug,
                      name: ev.name,
                      venue_name: ev.venue_name,
                      city: ev.city,
                      state: ev.state ?? null,
                      event_date: ev.event_date,
                      upload_count: ev.upload_count,
                      entity: ent ?? { slug: '', name: '' },
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Browse by type
            </h2>
            <div className="flex flex-wrap gap-2">
              {TYPE_PILLS.map((pill) => {
                const href = pill.value ? `/?type=${pill.value}` : '/';
                const active = (typeFilter || '') === pill.value;
                return (
                  <Link
                    key={pill.value || 'all'}
                    href={href}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'bg-white text-ink'
                        : 'border border-ash text-gray-300 hover:bg-ash hover:text-white'
                    }`}
                  >
                    {pill.label}
                  </Link>
                );
              })}
            </div>
          </div>
          {entities.length === 0 ? (
            <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
              No matches.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {entities.map((e) => (
                <EntityCard key={e.slug} entity={e} showStats />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeaturedClip({ media }: { media: FeaturedMedia }) {
  const ev = media.event;
  const entity = ev ? (Array.isArray(ev.entity) ? ev.entity[0] : ev.entity) : null;
  if (!media.mux_playback_id) return null;
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-lg bg-black">
        <VideoPlayer
          playbackId={media.mux_playback_id}
          muted
          poster={media.thumbnail_url ?? undefined}
        />
      </div>
      <div className="flex flex-col justify-center">
        <span className="text-xs uppercase tracking-wider text-gray-500">Featured</span>
        {entity ? <h1 className="mt-1 text-3xl font-bold">{entity.name}</h1> : null}
        {ev ? (
          <p className="mt-1 text-sm text-gray-400">
            {ev.venue_name}, {ev.city}
          </p>
        ) : null}
        {media.song_tag ? (
          <p className="mt-2 text-sm italic text-gray-300">“{media.song_tag}”</p>
        ) : null}
        {entity && ev ? (
          <Link
            href={`/${entity.slug}`}
            className="mt-5 inline-flex w-fit items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-gray-200"
          >
            Watch more from {entity.name} →
          </Link>
        ) : null}
      </div>
    </section>
  );
}

