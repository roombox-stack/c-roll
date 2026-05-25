// /[entitySlug] — Entity page (artist / team / event brand / venue).
//
// Layout (top → bottom):
//   1. Hero — verified/genre badges, name, archive summary, Follow + fan count
//             on the left; 2×3 grid of top media thumbnails on the right.
//   2. Stats strip — 4 divider-separated tiles below the hero.
//   3. Fan highlights — pills row + 1-hero + 4-small grid.
//   4. Most filmed songs — 5 song cards with colored progress bars.
//   5. Recent shows — 4 colored gradient event cards (no thumb strip).
//   6. Full archive — single accordion row with database icon.

import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Nav } from '@/components/nav';
import { FullSongBadge } from '@/components/media-card';
import { type EntityType, type SectionTag } from '@/lib/types';
import { formatCount, formatDuration, formatEventDate } from '@/components/format';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────────

type Highlight = 'best' | 'crowd' | 'stage' | 'acoustic' | 'recent';

const HIGHLIGHTS: { value: Highlight; label: string }[] = [
  { value: 'best', label: 'All time best' },
  { value: 'crowd', label: 'Crowd energy' },
  { value: 'stage', label: 'Stage moments' },
  { value: 'acoustic', label: 'Acoustic' },
  { value: 'recent', label: 'Most recent' },
];

interface EntityRow {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  genre: string | null;
  bio: string | null;
  verified: boolean;
  hero_image_url: string | null;
  follower_count: number;
}

interface MediaRow {
  id: string;
  file_type: 'photo' | 'video';
  storage_url: string;
  thumbnail_url: string | null;
  mux_playback_id: string | null;
  duration_sec: number | null;
  song_tag: string | null;
  section_tag: SectionTag | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  is_full_song: boolean;
  created_at: string;
  upload_session: string | null;
  uploader_id: string | null;
  event_id: string;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  upload_count: number;
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function fetchEntity(slug: string): Promise<EntityRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('entities')
    .select('id, slug, name, type, genre, bio, verified, hero_image_url, follower_count')
    .eq('slug', slug)
    .maybeSingle();
  return (data as EntityRow) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { entitySlug: string };
}): Promise<Metadata> {
  const entity = await fetchEntity(params.entitySlug);
  if (!entity) return { title: 'Not found' };
  const title = `${entity.name} fan photos & videos`;
  const description = entity.bio ?? `Fan-shot photos and videos from ${entity.name} shows.`;
  return {
    title,
    description,
    alternates: { canonical: `/${entity.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: entity.hero_image_url ? [{ url: entity.hero_image_url }] : undefined,
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function EntityPage({
  params,
  searchParams,
}: {
  params: { entitySlug: string };
  searchParams: { filter?: string; song?: string };
}) {
  const entity = await fetchEntity(params.entitySlug);
  if (!entity) notFound();

  const supabase = createAdminClient();
  const activeFilter: Highlight =
    (HIGHLIGHTS.find((h) => h.value === searchParams.filter)?.value as Highlight) ?? 'best';
  const activeSong = searchParams.song ?? '';

  // Top media for the hero grid — videos preferred, photos as fallback.
  const [topMediaRes, allMediaRes, allEventsRes] = await Promise.all([
    supabase
      .from('media')
      .select(
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, caption, view_count, like_count, is_full_song',
      )
      .eq('entity_id', entity.id)
      .eq('status', 'active')
      .order('view_count', { ascending: false })
      .limit(6),

    supabase
      .from('media')
      .select(
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, section_tag, caption, view_count, like_count, is_full_song, created_at, upload_session, uploader_id, event_id',
      )
      .eq('entity_id', entity.id)
      .eq('status', 'active')
      .limit(200),

    supabase
      .from('events')
      .select('id, slug, name, venue_name, city, state, event_date, upload_count')
      .eq('entity_id', entity.id)
      .order('event_date', { ascending: false }),
  ]);

  const topMedia = (topMediaRes.data ?? []) as unknown as MediaRow[];
  const allMedia = (allMediaRes.data ?? []) as unknown as MediaRow[];
  const allEvents = (allEventsRes.data ?? []) as unknown as EventRow[];

  // Stats
  const photoCount = allMedia.filter((m) => m.file_type === 'photo').length;
  const videoCount = allMedia.filter((m) => m.file_type === 'video').length;
  const totalMedia = photoCount + videoCount;
  const contribKeys = new Set<string>();
  for (const m of allMedia) {
    if (m.uploader_id) contribKeys.add(`u:${m.uploader_id}`);
    else if (m.upload_session) contribKeys.add(`s:${m.upload_session}`);
  }
  const earliestYear =
    allEvents.length > 0
      ? new Date(allEvents[allEvents.length - 1].event_date).getFullYear()
      : null;

  // Highlights filter
  const highlightsMedia = filterHighlights(allMedia, activeFilter, activeSong);

  // Top songs (min 3 clips per spec — but show top 5 anyway for the design)
  const songCounts = new Map<string, number>();
  for (const m of allMedia) {
    if (m.song_tag) songCounts.set(m.song_tag, (songCounts.get(m.song_tag) ?? 0) + 1);
  }
  const topSongs = Array.from(songCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxSongCount = topSongs[0]?.[1] ?? 1;

  // Events
  const recentEvents = allEvents.slice(0, 4);

  const ldType =
    entity.type === 'artist'
      ? 'MusicGroup'
      : entity.type === 'team'
        ? 'SportsTeam'
        : 'Organization';
  const ld = {
    '@context': 'https://schema.org',
    '@type': ldType,
    name: entity.name,
    ...(entity.genre && entity.type === 'artist' ? { genre: entity.genre } : {}),
    ...(entity.bio ? { description: entity.bio } : {}),
    ...(entity.hero_image_url ? { image: entity.hero_image_url } : {}),
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${entity.slug}`,
  };

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-ash">
        {entity.hero_image_url ? (
          <Image
            src={entity.hero_image_url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-20"
            unoptimized
            priority
          />
        ) : null}
        <div className="relative bg-gradient-to-r from-ink via-ink/95 to-ink/60">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_540px] lg:py-16">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {entity.verified ? <VerifiedBadge /> : null}
                {entity.genre ? <GenreBadge>{entity.genre}</GenreBadge> : null}
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{entity.name}</h1>
              <p className="text-sm text-gray-400 md:text-base">
                {formatCount(totalMedia)} photos &amp; videos across{' '}
                {formatCount(allEvents.length)}{' '}
                {allEvents.length === 1 ? 'show' : 'shows'}
                {earliestYear ? ` · archive from ${earliestYear}` : ''}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  className="rounded-md border border-ash bg-smoke/60 px-5 py-2 text-sm font-medium text-white hover:bg-ash"
                >
                  Follow
                </button>
                <span className="text-sm text-gray-400">
                  {formatCount(entity.follower_count)} fans following
                </span>
              </div>
            </div>

            <HeroGrid media={topMedia} />
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <section className="border-b border-ash bg-smoke/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-ash md:grid-cols-4">
          <StatTile value={formatCount(totalMedia)} label="Photos & videos" />
          <StatTile value={formatCount(allEvents.length)} label="Shows covered" />
          <StatTile value={formatCount(contribKeys.size)} label="Contributors" />
          <StatTile value={earliestYear ? String(earliestYear) : '—'} label="Earliest show" />
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        {/* ── Fan highlights ──────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Fan highlights"
            right={
              totalMedia > 0
                ? `see all ${formatCount(totalMedia)} →`
                : null
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {HIGHLIGHTS.map((h) => (
              <FilterPill
                key={h.value}
                href={h.value === 'best' ? `/${entity.slug}` : `/${entity.slug}?filter=${h.value}`}
                active={activeFilter === h.value}
              >
                {h.label}
              </FilterPill>
            ))}
          </div>
          {activeSong ? (
            <p className="mt-3 text-sm text-gray-400">
              Filtered to “{activeSong}” —{' '}
              <Link
                href={`/${entity.slug}${activeFilter === 'best' ? '' : `?filter=${activeFilter}`}`}
                className="text-white underline"
              >
                clear
              </Link>
            </p>
          ) : null}

          <div className="mt-5">
            {highlightsMedia.length === 0 ? (
              <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
                No highlights match this filter yet.
              </p>
            ) : (
              <HighlightsGrid media={highlightsMedia} />
            )}
          </div>
        </section>

        {/* ── Most filmed songs ───────────────────────────────────────── */}
        {topSongs.length > 0 ? (
          <section>
            <SectionHeader title="Most filmed songs" right="how this works →" />
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {topSongs.map(([song, count], i) => (
                <SongCard
                  key={song}
                  song={song}
                  count={count}
                  maxCount={maxSongCount}
                  colorIndex={i}
                  href={`/${entity.slug}?song=${encodeURIComponent(song)}`}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Recent shows ────────────────────────────────────────────── */}
        {recentEvents.length > 0 ? (
          <section>
            <SectionHeader
              title="Recent shows"
              right={
                allEvents.length > 4
                  ? `all ${formatCount(allEvents.length)} shows →`
                  : null
              }
            />
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentEvents.map((ev) => (
                <ColoredEventCard
                  key={ev.id}
                  event={ev}
                  entitySlug={entity.slug}
                  href={`/${entity.slug}/${ev.slug}`}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Full archive ────────────────────────────────────────────── */}
        {allEvents.length > 0 ? (
          <section id="archive">
            <ArchiveCard
              entitySlug={entity.slug}
              events={allEvents}
              earliestYear={earliestYear}
            />
          </section>
        ) : null}
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
    </div>
  );
}

// ── Hero badges ──────────────────────────────────────────────────────────────

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/60 bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-300">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-1.2 14.6L6.6 12.4l1.4-1.4 2.8 2.8 5.6-5.6 1.4 1.4-7 7z" />
      </svg>
      Verified
    </span>
  );
}

function GenreBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-purple-700/60 bg-purple-900/30 px-3 py-1 text-xs font-medium text-purple-300">
      {children}
    </span>
  );
}

// ── Hero grid (2×3 thumbnails) ───────────────────────────────────────────────

function HeroGrid({ media }: { media: MediaRow[] }) {
  // Always render 6 slots so the grid keeps shape with sparse data.
  const slots = Array.from({ length: 6 }, (_, i) => media[i] ?? null);
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2">
      {slots.map((m, i) => (
        <HeroThumb key={m?.id ?? `empty-${i}`} media={m} />
      ))}
    </div>
  );
}

function HeroThumb({ media }: { media: MediaRow | null }) {
  if (!media) {
    return <div className="aspect-square rounded-md bg-smoke/60" />;
  }
  const thumb =
    media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const isVideo = media.file_type === 'video';
  const label = media.song_tag ?? media.caption ?? '';
  return (
    <Link
      href={`/watch/${media.id}`}
      className="group relative block aspect-square overflow-hidden rounded-md bg-smoke"
    >
      {thumb ? (
        <Image
          src={thumb}
          alt={label}
          fill
          sizes="180px"
          className="object-cover"
          unoptimized
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/20" />

      {isVideo ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/80 p-2 opacity-90 transition group-hover:scale-110">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="black" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      ) : null}

      <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
        {formatCount(media.view_count)}
        {media.view_count > 0 ? ' views' : ''}
      </span>

      {label ? (
        <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-xs font-medium text-white">
          {label}
        </span>
      ) : null}
    </Link>
  );
}

// ── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-6 text-center md:py-8">
      <div className="text-3xl font-semibold tabular-nums md:text-4xl">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-gray-500">{label}</div>
    </div>
  );
}

// ── Section header (title + optional right text/link) ───────────────────────

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {right ? (
        <span className="text-sm text-gray-400 hover:text-white">{right}</span>
      ) : null}
    </div>
  );
}

// ── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-white/20 bg-white/10 text-white'
          : 'border-ash text-gray-300 hover:border-gray-500 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

// ── Fan highlights grid (1 hero + 4 small) ───────────────────────────────────

function HighlightsGrid({ media }: { media: MediaRow[] }) {
  const hero = media[0];
  const rest = media.slice(1, 5);
  if (!hero) return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_1fr_1fr] md:grid-rows-2">
      <div className="md:col-span-1 md:row-span-2">
        <HighlightHeroCard media={hero} />
      </div>
      {rest.map((m) => (
        <HighlightCard key={m.id} media={m} />
      ))}
    </div>
  );
}

function HighlightHeroCard({ media }: { media: MediaRow }) {
  const thumb =
    media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const isVideo = media.file_type === 'video';
  return (
    <Link
      href={`/watch/${media.id}`}
      className="group relative block h-full overflow-hidden rounded-lg bg-smoke"
    >
      <div className="relative h-full min-h-[280px] md:min-h-[420px]">
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            sizes="(min-width:768px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-950 to-ink" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

        {/* View badge top-left */}
        <span className="absolute left-3 top-3 rounded-md bg-purple-600/90 px-2 py-1 text-xs font-semibold text-white">
          {formatCount(media.view_count)} views
        </span>

        {isVideo && media.is_full_song ? (
          <FullSongBadge className="absolute right-3 top-3" />
        ) : null}

        {isVideo ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white/85 p-4 opacity-90 transition group-hover:scale-110">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="black" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        ) : null}

        {isVideo && media.duration_sec ? (
          <span className="absolute bottom-3 right-3 rounded bg-black/70 px-1.5 py-0.5 text-xs tabular-nums">
            {formatDuration(media.duration_sec)}
          </span>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
          <div className="text-base font-semibold">
            {media.song_tag ?? media.caption ?? 'Untitled clip'}
          </div>
          <div className="text-xs text-gray-300">
            <span>♥ {formatCount(media.like_count)}</span>
            {media.section_tag ? <span> · {sectionLabel(media.section_tag)}</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function HighlightCard({ media }: { media: MediaRow }) {
  const thumb =
    media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const isVideo = media.file_type === 'video';
  return (
    <Link
      href={`/watch/${media.id}`}
      className="group relative block overflow-hidden rounded-lg bg-smoke"
    >
      <div className="relative aspect-video">
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            sizes="240px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {isVideo && media.is_full_song ? (
          <FullSongBadge className="absolute left-2 top-2" />
        ) : null}

        {isVideo ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white/80 p-2.5 opacity-90 transition group-hover:scale-110">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="black" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        ) : null}

        {isVideo && media.duration_sec ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums">
            {formatDuration(media.duration_sec)}
          </span>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-2.5 text-xs">
          <div className="truncate text-sm font-medium">
            {media.song_tag ?? media.caption ?? 'Untitled'}
          </div>
          <div className="mt-0.5 text-[11px] text-gray-300">
            ♥ {formatCount(media.like_count)}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Song card with colored progress bar ─────────────────────────────────────

const SONG_BAR_COLORS = [
  'bg-purple-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-amber-400',
  'bg-blue-500',
];

function SongCard({
  song,
  count,
  maxCount,
  colorIndex,
  href,
}: {
  song: string;
  count: number;
  maxCount: number;
  colorIndex: number;
  href: string;
}) {
  const pct = Math.max(8, Math.round((count / maxCount) * 100));
  return (
    <Link
      href={href}
      className="block rounded-lg border border-ash bg-smoke p-4 transition hover:border-gray-500"
    >
      <div className="truncate font-medium">{song}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
        {formatCount(count)} clips
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ash">
        <div
          className={`h-full rounded-full ${SONG_BAR_COLORS[colorIndex % SONG_BAR_COLORS.length]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}

// ── Colored event card (Recent shows) ────────────────────────────────────────

const EVENT_GRADIENTS = [
  'from-purple-900 via-purple-800 to-purple-950',
  'from-emerald-900 via-emerald-800 to-emerald-950',
  'from-amber-900 via-amber-800 to-amber-950',
  'from-blue-900 via-blue-800 to-blue-950',
  'from-rose-900 via-rose-800 to-rose-950',
  'from-teal-900 via-teal-800 to-teal-950',
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function ColoredEventCard({
  event,
  href,
}: {
  event: EventRow;
  entitySlug: string;
  href: string;
}) {
  const gradient = EVENT_GRADIENTS[hashIndex(event.id, EVENT_GRADIENTS.length)];
  return (
    <Link
      href={href}
      className={`group relative block aspect-[5/4] overflow-hidden rounded-lg bg-gradient-to-br ${gradient} transition hover:brightness-110`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/10" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-white/20 p-3 backdrop-blur transition group-hover:scale-110">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-4 text-white">
        <div className="text-xs text-gray-300">{formatEventDate(event.event_date)}</div>
        <div className="font-semibold leading-tight">
          {event.venue_name}
          {event.city ? `, ${event.city}` : ''}
        </div>
        <div className="text-xs text-gray-300">
          {formatCount(event.upload_count)} uploads
        </div>
      </div>
    </Link>
  );
}

// ── Full archive (accordion-style row) ───────────────────────────────────────

function ArchiveCard({
  entitySlug,
  events,
  earliestYear,
}: {
  entitySlug: string;
  events: EventRow[];
  earliestYear: number | null;
}) {
  const byYear = new Map<number, EventRow[]>();
  for (const ev of events) {
    const y = new Date(ev.event_date).getFullYear();
    const bucket = byYear.get(y) ?? [];
    bucket.push(ev);
    byYear.set(y, bucket);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);
  const span = earliestYear ? `${earliestYear} to present` : 'archive';

  return (
    <details className="group overflow-hidden rounded-lg border border-ash bg-smoke">
      <summary className="flex cursor-pointer select-none items-center gap-4 p-4 hover:bg-ash/50">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="font-semibold">
            Full archive — {events.length} {events.length === 1 ? 'show' : 'shows'}, {span}
          </div>
          <div className="text-xs text-gray-400">
            Browse every show, every setlist, every upload by date and venue
          </div>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-500 transition group-open:rotate-90"
          aria-hidden
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </summary>
      <div className="border-t border-ash">
        {years.map((year) => (
          <div key={year} className="border-t border-ash px-4 py-4 first:border-t-0">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
              {year}
            </h3>
            <ul className="space-y-0.5 text-sm">
              {byYear.get(year)!.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/${entitySlug}/${ev.slug}`}
                    className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-ash"
                  >
                    <span>
                      <span className="text-gray-500">{formatEventDate(ev.event_date)}</span>{' '}
                      · <span className="text-white">{ev.venue_name}</span>
                      <span className="text-gray-400">
                        , {ev.city}
                        {ev.state ? `, ${ev.state}` : ''}
                      </span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {ev.upload_count} uploads
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sectionLabel(tag: SectionTag): string {
  return tag === 'floor'
    ? 'Floor/Pit'
    : tag === 'section_100'
      ? 'Section 100s'
      : tag === 'section_200'
        ? 'Section 200s'
        : tag === 'upper'
          ? 'Upper deck'
          : tag === 'stage_left'
            ? 'Stage left'
            : 'Stage right';
}

function filterHighlights(
  media: MediaRow[],
  filter: Highlight,
  song: string,
): MediaRow[] {
  let filtered = song ? media.filter((m) => m.song_tag === song) : media.slice();
  switch (filter) {
    case 'best':
      filtered.sort((a, b) => b.like_count - a.like_count);
      break;
    case 'crowd':
      filtered = filtered.filter(
        (m) => m.section_tag === 'floor' || m.section_tag === 'section_100',
      );
      filtered.sort((a, b) => b.like_count - a.like_count);
      break;
    case 'stage':
      filtered.sort((a, b) => b.view_count - a.view_count);
      break;
    case 'acoustic':
      filtered = filtered.filter((m) => {
        const s = (m.song_tag ?? '').toLowerCase();
        const c = (m.caption ?? '').toLowerCase();
        return s.includes('acoustic') || c.includes('acoustic');
      });
      filtered.sort((a, b) => b.like_count - a.like_count);
      break;
    case 'recent':
      filtered.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      break;
  }
  return filtered;
}
