// /[entitySlug] — Entity page (artist / team / event brand / venue).
//
// Visual redesign matching the c-roll design system:
//   1. Hero — cinematic bg, massive Archivo Black name, genre pill, CTA buttons,
//             2×3 thumbnail grid on the right.
//   2. Stats strip — horizontal chip row with pipe dividers.
//   3. Fan highlights — red // eyebrow, heading, filter pills, 1-hero + grid.
//   4. Most filmed songs — red // eyebrow, ranked list with color swatches.
//   5. Recent shows — red // eyebrow, 4-card gradient grid, LAST SHOW badge.
//   6. Archive bar — full-width dark section with expandable year list.
//
// DATA FETCHING IS COMPLETELY UNCHANGED. Only the visual/component layer changed.

import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { type EntityType, type SectionTag } from '@/lib/types';
import { fetchEventHeroThumbs } from '@/lib/event-thumbs';
import { FollowButton } from '@/components/follow-button';
import { getCurrentUser } from '@/lib/auth';
import { formatCount, formatEventDate } from '@/components/format';
import {
  EntityPageMediaWrapper,
  EntityHeroGridWithModal,
  EntityHighlightsGridWithModal,
  type EntityMediaItem,
  type EntityEventSummary,
} from './entity-browse';

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

// Sports teams reuse the same filter VALUES (so filterHighlights logic is
// unchanged) but with field-appropriate labels. "Acoustic" is dropped — its
// filter keys off caption text that doesn't apply to games.
const TEAM_HIGHLIGHTS: { value: Highlight; label: string }[] = [
  { value: 'best', label: 'All time best' },
  { value: 'crowd', label: 'Crowd energy' },
  { value: 'stage', label: 'Field moments' },
  { value: 'recent', label: 'Most recent' },
];

interface EntityRow {
  hero_media_ids: string[] | null;
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  genre: string | null;
  bio: string | null;
  verified: boolean;
  claimed: boolean | null;
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
  event_id: string | null;
  is_full_song: boolean;
  created_at: string;
  upload_session: string | null;
  uploader_id: string | null;
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
    .select('id, slug, name, type, genre, bio, verified, claimed, hero_image_url, hero_media_ids, follower_count')
    .eq('slug', slug)
    .eq('hidden', false)
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
      images: entity.hero_image_url ? [{ url: entity.hero_image_url, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: entity.hero_image_url ? [entity.hero_image_url] : undefined,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickHeroGrid(pool: MediaRow[], n: number): MediaRow[] {
  const picked: MediaRow[] = [];
  const seenSections = new Set<string>();
  for (const m of pool) {
    if (picked.length >= n) break;
    if (m.section_tag && !seenSections.has(m.section_tag)) {
      seenSections.add(m.section_tag);
      picked.push(m);
    }
  }
  if (picked.length < n) {
    const pickedIds = new Set(picked.map((m) => m.id));
    for (const m of pool) {
      if (picked.length >= n) break;
      if (!pickedIds.has(m.id)) picked.push(m);
    }
  }
  return picked.slice(0, n);
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
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, section_tag, caption, view_count, like_count, is_full_song, event_id',
      )
      .eq('entity_id', entity.id)
      .eq('status', 'active')
      .order('view_count', { ascending: false })
      .limit(30),

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

  // Hero grid: use admin-pinned IDs when present, otherwise auto-select.
  const pinnedIds: string[] = Array.isArray(entity.hero_media_ids) ? entity.hero_media_ids : [];
  let heroMedia: MediaRow[];
  if (pinnedIds.length > 0) {
    const byId = new Map<string, MediaRow>(topMedia.map((m) => [m.id, m]));
    // Also search allMedia in case pinned items aren't in the top-30.
    for (const m of allMedia) if (!byId.has(m.id)) byId.set(m.id, m);
    heroMedia = pinnedIds
      .map((id) => byId.get(id))
      .filter((m): m is MediaRow => m != null);
  } else {
    // Auto-select: prefer section variety then fill by view count.
    heroMedia = pickHeroGrid(topMedia, 6);
  }

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

  // Hero thumbnails for the show cards — Mux thumb of the most-viewed
  // active video on each event (if any).
  const heroThumbs = await fetchEventHeroThumbs(allEvents.map((e) => e.id));

  // Current user + whether they follow this entity (powers the Follow button).
  const currentUser = await getCurrentUser();
  let initiallyFollowing = false;
  if (currentUser) {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('entity_id', entity.id)
      .maybeSingle();
    initiallyFollowing = !!data;
  }

  // Events — "Recent shows" = past shows only (most-recently-ended first).
  // allEvents is already sorted by event_date desc, so filtering preserves order.
  const todayISO = new Date().toISOString().slice(0, 10);
  const pastEvents = allEvents.filter((ev) => ev.event_date <= todayISO);
  const recentEvents = pastEvents.slice(0, 4);

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

  const allMediaItems: EntityMediaItem[] = allMedia.map((m) => ({
    id: m.id,
    file_type: m.file_type,
    storage_url: m.storage_url,
    thumbnail_url: m.thumbnail_url,
    mux_playback_id: m.mux_playback_id,
    duration_sec: m.duration_sec,
    song_tag: m.song_tag,
    section_tag: m.section_tag,
    caption: m.caption,
    view_count: m.view_count,
    like_count: m.like_count,
    is_full_song: m.is_full_song,
    event_id: m.event_id,
    uploader_id: m.uploader_id,
  }));

  const heroMediaItems: EntityMediaItem[] = heroMedia.map((m) => ({
    id: m.id,
    file_type: m.file_type,
    storage_url: m.storage_url,
    thumbnail_url: m.thumbnail_url,
    mux_playback_id: m.mux_playback_id,
    duration_sec: m.duration_sec,
    song_tag: m.song_tag,
    section_tag: m.section_tag,
    caption: m.caption,
    view_count: m.view_count,
    like_count: m.like_count,
    is_full_song: m.is_full_song,
    event_id: m.event_id,
    uploader_id: m.uploader_id,
  }));

  const highlightsMediaItems: EntityMediaItem[] = highlightsMedia.map((m) => ({
    id: m.id,
    file_type: m.file_type,
    storage_url: m.storage_url,
    thumbnail_url: m.thumbnail_url,
    mux_playback_id: m.mux_playback_id,
    duration_sec: m.duration_sec,
    song_tag: m.song_tag,
    section_tag: m.section_tag,
    caption: m.caption,
    view_count: m.view_count,
    like_count: m.like_count,
    is_full_song: m.is_full_song,
    event_id: m.event_id,
    uploader_id: m.uploader_id,
  }));

  const eventSummaries: EntityEventSummary[] = allEvents.map((ev) => ({
    id: ev.id,
    slug: ev.slug,
    name: ev.name,
    venue_name: ev.venue_name,
    city: ev.city,
    event_date: ev.event_date,
  }));

  const eventCityPairs: [string, string][] = allEvents.map((ev) => [ev.id, ev.city]);

  return (
    <EntityPageMediaWrapper
      allMedia={allMediaItems}
      entitySlug={entity.slug}
      eventMap={eventSummaries}
    >
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-white">
      {/* Ambient stage-lighting glows */}
      <div aria-hidden className="pointer-events-none fixed left-1/2 top-[55vh] z-0 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]" style={{ background: 'rgba(255,107,0,0.14)' }} />
      <div aria-hidden className="pointer-events-none fixed bottom-[15vh] left-0 z-0 h-[180px] w-[300px] -translate-x-[30%] rounded-full blur-[120px]" style={{ background: 'rgba(220,80,0,0.13)' }} />
      <div aria-hidden className="pointer-events-none fixed right-[-60px] top-[8vh] z-0 h-[250px] w-[400px] rounded-full blur-[110px]" style={{ background: 'rgba(255,140,0,0.09)' }} />

      <Nav />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative z-[1] overflow-hidden">
        {/* Background: concert photo at high opacity — cinematic, movie-poster feel */}
        {entity.hero_image_url ? (
          <Image
            src={entity.hero_image_url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-top opacity-55"
            unoptimized
            priority
          />
        ) : null}
        {/*
          Two-layer gradient approach:
          • Left-to-right: heavy ink on the left third (where text lives),
            fading to near-transparent on the right so the photo reads clearly.
          • Bottom vignette: subtle darkening only at the very bottom edge.
          Together these let the right side of the image glow through fully
          while keeping the left text column legible.
        */}
        <div className="absolute inset-0 bg-gradient-to-l from-ink from-[5%] via-ink/75 via-[38%] to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent via-[30%] to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 lg:pb-20 lg:pt-16">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_460px] lg:gap-14">

            {/* Left column — text-shadow on the whole column keeps every element legible */}
            <div className="space-y-6 [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]">

              {/* Eyebrow / breadcrumb */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-widest">
                <span className="text-croll">In C·ROLL</span>
                {allEvents.length > 0 && (
                  <>
                    <span className="text-ash">·</span>
                    <span className="text-gray-500">{allEvents.length} {allEvents.length === 1 ? 'Show' : 'Shows'}</span>
                  </>
                )}
                {totalMedia > 0 && (
                  <>
                    <span className="text-ash">·</span>
                    <span className="text-gray-500">{formatCount(totalMedia)} Clips</span>
                  </>
                )}
              </div>

              {/* Artist name — Archivo Black, massive */}
              <h1 className="font-display text-[clamp(2.75rem,9vw,6.5rem)] font-black leading-[0.93] tracking-tight text-white [text-shadow:0_2px_32px_rgba(0,0,0,0.8)]">
                {entity.name}
              </h1>

              {/* Genre + verified pills */}
              <div className="flex flex-wrap items-center gap-2">
                {entity.verified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/50 bg-sky-500/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-sky-300">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-1.2 14.6L6.6 12.4l1.4-1.4 2.8 2.8 5.6-5.6 1.4 1.4-7 7z" />
                    </svg>
                    Verified
                  </span>
                ) : null}
                {entity.genre ? (
                  <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-300">
                    {entity.genre}
                  </span>
                ) : null}
              </div>

              {/* Bio */}
              {entity.bio ? (
                <p className="max-w-md text-sm leading-relaxed text-gray-400">{entity.bio}</p>
              ) : null}

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {recentEvents[0] ? (
                  <Link
                    href={`/${entity.slug}/${recentEvents[0].slug}`}
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch latest show
                  </Link>
                ) : null}
                <FollowButton
                  entitySlug={entity.slug}
                  initialFollowing={initiallyFollowing}
                  initialFollowerCount={entity.follower_count}
                  isAuthed={!!currentUser}
                  variant="hero"
                  className="px-5 py-2.5"
                />
              </div>

              {/* Claimed badge or claim link */}
              {entity.claimed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-croll/40 bg-croll/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-croll">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-1.2 14.6L6.6 12.4l1.4-1.4 2.8 2.8 5.6-5.6 1.4 1.4-7 7z" />
                  </svg>
                  Claimed
                </span>
              ) : (
                <Link
                  href={`/claim?name=${encodeURIComponent(entity.name)}&type=${entity.type}`}
                  className="text-xs text-gray-600 transition hover:text-gray-400"
                >
                  Is this you? Claim this page →
                </Link>
              )}
            </div>

            {/* Right column — 3×2 hero grid */}
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-white/35">
                // FROM THE FLOOR TO THE UPPER DECK
              </p>
              <EntityHeroGridWithModal media={heroMediaItems} eventCityMap={eventCityPairs} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="relative z-[1] border-y border-white/5 bg-smoke/30">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4">
          <div className="flex min-w-max items-stretch divide-x divide-white/5">
            <StatChip label="CLIPS" value={formatCount(videoCount)} />
            <StatChip label="PHOTOS" value={formatCount(photoCount)} />
            <StatChip label={entity.type === 'team' ? 'GAMES COVERED' : 'SHOWS COVERED'} value={String(allEvents.length)} />
            <StatChip label="CONTRIBUTORS" value={formatCount(contribKeys.size)} />
            {earliestYear ? <StatChip label="SINCE" value={String(earliestYear)} /> : null}
          </div>
        </div>
      </div>

      <main className="relative z-[1] mx-auto max-w-7xl space-y-20 px-4 py-16">

        {/* ── Fan highlights ──────────────────────────────────────────── */}
        <section>
          <RedEyebrow>FAN HIGHLIGHTS</RedEyebrow>
          <h2 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">
            The best moments, by the people who were there.
          </h2>

          {/* Filter pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {(entity.type === 'team' ? TEAM_HIGHLIGHTS : HIGHLIGHTS).map((h) => (
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
              Filtered to &ldquo;{activeSong}&rdquo; —{' '}
              <Link
                href={`/${entity.slug}${activeFilter === 'best' ? '' : `?filter=${activeFilter}`}`}
                className="text-white underline"
              >
                clear
              </Link>
            </p>
          ) : null}

          <div className="mt-6">
            {highlightsMedia.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-6 py-12 text-center">
                <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                  // NO FOOTAGE YET
                </p>
                <p className="mt-3 text-sm text-gray-500">
                  Be the first to film at {entity.name}&apos;s next show.
                </p>
                <Link
                  href={
                    allEvents.find((ev) => ev.event_date >= todayISO)
                      ? `/${entity.slug}/${allEvents.find((ev) => ev.event_date >= todayISO)!.slug}`
                      : '/upload'
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5"
                >
                  Upload footage →
                </Link>
              </div>
            ) : (
              <EntityHighlightsGridWithModal items={highlightsMediaItems} />
            )}
          </div>
        </section>

        {/* ── Most filmed songs ───────────────────────────────────────── */}
        {topSongs.length > 0 ? (
          <section>
            <RedEyebrow>{entity.type === 'team' ? 'MOST FILMED MOMENTS' : 'MOST FILMED SONGS'}</RedEyebrow>
            <h2 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">
              {entity.type === 'team'
                ? `The plays that broke phones across ${allEvents.length} ${allEvents.length === 1 ? 'game' : 'games'}.`
                : `The ones that broke phones across ${allEvents.length} ${allEvents.length === 1 ? 'show' : 'shows'}.`}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-px bg-white/5 md:grid-cols-5">
              {topSongs.map(([song, count], i) => (
                <SongCard
                  key={song}
                  rank={i + 1}
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
        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-600">
            Missing a show?{' '}
            <Link href="/request" className="text-gray-500 underline hover:text-white">
              Request it be added →
            </Link>
          </p>
        ) : null}

        {recentEvents.length > 0 ? (
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <RedEyebrow>{entity.type === 'team' ? 'RECENT GAMES' : 'RECENT SHOWS'}</RedEyebrow>
                <h2 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">
                  {entity.type === 'team'
                    ? 'Latest games, freshest clips.'
                    : 'Latest nights, freshest uploads.'}
                </h2>
              </div>
              {allEvents.length > 4 ? (
                <Link
                  href={`/${entity.slug}#archive`}
                  className="shrink-0 text-sm text-gray-500 transition hover:text-white"
                >
                  All {allEvents.length} {entity.type === 'team' ? 'Games' : 'Shows'} →
                </Link>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {recentEvents.map((ev, i) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  isLatest={i === 0}
                  href={`/${entity.slug}/${ev.slug}`}
                  heroThumbUrl={heroThumbs.get(ev.id) ?? null}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {/* ── Archive bar ─────────────────────────────────────────────────── */}
      {allEvents.length > 0 ? (
        <section id="archive" className="border-t border-white/5 bg-smoke/40">
          <div className="mx-auto max-w-7xl px-4 py-16">
            <RedEyebrow>C·ROLL ARCHIVE</RedEyebrow>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-heading text-3xl font-bold text-white md:text-4xl">
                  All {allEvents.length}{' '}
                  {entity.type === 'team'
                    ? allEvents.length === 1
                      ? 'game'
                      : 'games'
                    : allEvents.length === 1
                      ? 'show'
                      : 'shows'}{' '}
                  &middot; {formatCount(totalMedia)} clips
                  {earliestYear ? ` · since ${earliestYear}` : ''}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {entity.type === 'team'
                    ? 'Every game, every play, every upload — by date and venue.'
                    : 'Every show, every setlist, every upload — by date and venue.'}
                </p>
              </div>
            </div>

            <div className="mt-10">
              <ArchiveList events={allEvents} entitySlug={entity.slug} />
            </div>
          </div>
        </section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <Footer />
    </div>
    </EntityPageMediaWrapper>
  );
}

// ── Design tokens / shared primitives ────────────────────────────────────────

/** Red // LABEL eyebrow used before every section heading */
function RedEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-croll">
      // {children}
    </p>
  );
}

// ── Stats strip chip ─────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start justify-center px-5 py-4">
      <span className="font-mono text-[9px] uppercase tracking-widest text-gray-600">{label}</span>
      <span className="mt-0.5 font-heading text-lg font-bold tabular-nums text-white">{value}</span>
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
          ? 'border-white bg-white text-ink'
          : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

// ── Song card ────────────────────────────────────────────────────────────────

// Deterministic color palettes per rank slot — placeholder for album art extraction.
const SONG_PALETTES: string[][] = [
  ['#e8342a', '#f59e0b', '#6366f1', '#10b981', '#ec4899', '#f97316'],
  ['#6366f1', '#3b82f6', '#f59e0b', '#14b8a6', '#ef4444', '#8b5cf6'],
  ['#f97316', '#84cc16', '#3b82f6', '#a855f7', '#f43f5e', '#06b6d4'],
  ['#06b6d4', '#f59e0b', '#6366f1', '#10b981', '#e8342a', '#84cc16'],
  ['#8b5cf6', '#f97316', '#22d3ee', '#84cc16', '#ef4444', '#f59e0b'],
];

function SongCard({
  rank,
  song,
  count,
  colorIndex,
  href,
}: {
  rank: number;
  song: string;
  count: number;
  maxCount: number;
  colorIndex: number;
  href: string;
}) {
  const palette = SONG_PALETTES[colorIndex % SONG_PALETTES.length];
  return (
    <Link
      href={href}
      className="group block bg-smoke p-5 transition hover:bg-ash"
    >
      {/* Rank */}
      <span className="font-display text-4xl font-black tabular-nums text-white/10 transition group-hover:text-white/20">
        {String(rank).padStart(2, '0')}
      </span>

      {/* Song name */}
      <p className="mt-3 truncate text-sm font-semibold text-white">{song}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-600">
        {formatCount(count)} clips
      </p>

      {/* Color swatch row */}
      <div className="mt-4 flex gap-1">
        {palette.map((color, i) => (
          <div
            key={i}
            className="h-3 flex-1 rounded-sm"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </Link>
  );
}

// ── Event card ───────────────────────────────────────────────────────────────

const EVENT_GRADIENTS = [
  'from-violet-950 via-violet-900 to-purple-950',
  'from-emerald-950 via-emerald-900 to-teal-950',
  'from-amber-950 via-amber-900 to-orange-950',
  'from-blue-950 via-blue-900 to-indigo-950',
  'from-rose-950 via-rose-900 to-pink-950',
  'from-cyan-950 via-cyan-900 to-sky-950',
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function EventCard({
  event,
  isLatest,
  href,
  heroThumbUrl,
}: {
  event: EventRow;
  isLatest: boolean;
  href: string;
  heroThumbUrl?: string | null;
}) {
  const gradient = EVENT_GRADIENTS[hashIndex(event.id, EVENT_GRADIENTS.length)];
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/25 hover:bg-white/[0.04]"
    >
      {/* Title block — pulled out above the image so a row of cards reads as a
          clean, scannable column of dates + venues. */}
      <div className="mb-2.5">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-croll">
            {formatEventDate(event.event_date)}
          </p>
          {isLatest ? (
            <span className="rounded bg-croll/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-croll">
              Last Show
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate font-heading text-base font-bold leading-tight text-white transition group-hover:text-croll md:text-lg">
          {event.venue_name}
          {event.city ? `, ${event.city}` : ''}
        </p>
        {event.upload_count > 0 ? (
          <p className="mt-0.5 font-mono text-[11px] text-gray-500">
            {formatCount(event.upload_count)} uploads
          </p>
        ) : (
          <p className="mt-0.5 font-mono text-[11px] text-croll/70">Upload footage →</p>
        )}
      </div>

      {/* Thumbnail */}
      <div
        className={`relative aspect-[5/4] overflow-hidden rounded-lg bg-gradient-to-br ${gradient} transition group-hover:brightness-110`}
      >
        {heroThumbUrl ? (
          <Image
            src={heroThumbUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition group-hover:scale-105"
            unoptimized
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/15 p-3 backdrop-blur transition group-hover:bg-white/25 group-hover:scale-110">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Archive list (year-grouped) ───────────────────────────────────────────────

function ArchiveList({ events, entitySlug }: { events: EventRow[]; entitySlug: string }) {
  const byYear = new Map<number, EventRow[]>();
  for (const ev of events) {
    const y = new Date(ev.event_date).getFullYear();
    const bucket = byYear.get(y) ?? [];
    bucket.push(ev);
    byYear.set(y, bucket);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);

  // Strict chronological order within each year: oldest → newest, regardless
  // of whether the show has already happened.
  for (const [, bucket] of byYear) {
    bucket.sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  }

  return (
    <div className="space-y-6">
      {years.map((year) => (
        <div key={year}>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-gray-600">
            {year}
          </h3>
          <ul className="space-y-px">
            {byYear.get(year)!.map((ev) => (
              <li key={ev.id}>
                <Link
                  href={`/${entitySlug}/${ev.slug}`}
                  className="flex items-center justify-between rounded px-2 py-2 transition hover:bg-white/5"
                >
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="text-gray-600">{formatEventDate(ev.event_date)}</span>
                    <span className="mx-1.5 text-ash">·</span>
                    <span className="text-white">{ev.venue_name}</span>
                    <span className="text-gray-500">
                      {ev.city ? `, ${ev.city}` : ''}
                      {ev.state ? `, ${ev.state}` : ''}
                    </span>
                  </span>
                  <span
                    className={`ml-4 shrink-0 font-mono text-[10px] ${
                      ev.upload_count > 0 ? 'text-emerald-400' : 'text-gray-600'
                    }`}
                  >
                    {ev.upload_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t.startsWith('untitled')) return null;
  return s.trim();
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
