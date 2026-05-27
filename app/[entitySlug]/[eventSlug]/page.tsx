// /[entitySlug]/[eventSlug] — event page.
//
// Three tabs (URL-driven, not client state):
//   ?tab=watch (default)  — featured player + up-next row + song browser
//   ?tab=browse           — photo/video + section filters, infinite-scroll grid
//   ?tab=upload           — link out to /upload/[slug]
//
// Watch tab: fetches up to 100 active media for in-memory setlist counts.
// Browse tab: fetches first page (24) from DB via the same query used by the
//   pagination API, then passes initialItems + nextCursor to <BrowseGrid />.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { VideoPlayer } from '@/components/video-player';
import { MediaCard, type MediaCardData } from '@/components/media-card';
import { BrowseGrid } from '@/components/browse-grid';
import { UploadButton } from '@/components/upload-button';
import { Footer } from '@/components/footer';
import { AttendanceButton } from '@/components/attendance-button';
import { SECTION_LABELS, SECTION_ORDER, type SectionTag } from '@/lib/types';
import { formatEventDate, formatCount } from '@/components/format';
import { UploadFlow, type EventOption } from '@/app/upload/upload-flow';

export const dynamic = 'force-dynamic';

type Tab = 'watch' | 'browse' | 'upload';


interface EventRow {
  id: string;
  entity_id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  tour_name: string | null;
  setlist: string[] | null;
  upload_count: number;
  photo_count: number;
  video_count: number;
  entity: { id: string; slug: string; name: string } | { id: string; slug: string; name: string }[] | null;
}

interface EventMedia extends MediaCardData {
  created_at: string;
  upload_session: string | null;
  uploader_id: string | null;
  section_tag: SectionTag | null;
  mux_playback_id: string | null;
  is_full_song: boolean;
}

async function fetchEvent(eventSlug: string): Promise<EventRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('events')
    .select(
      'id, entity_id, slug, name, venue_name, city, state, event_date, tour_name, setlist, upload_count, photo_count, video_count, entity:entities(id, slug, name)',
    )
    .eq('slug', eventSlug)
    .limit(1)
    .maybeSingle();
  return (data as unknown as EventRow) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { entitySlug: string; eventSlug: string };
}): Promise<Metadata> {
  const event = await fetchEvent(params.eventSlug);
  if (!event) return { title: 'Not found' };
  const entity = Array.isArray(event.entity) ? event.entity[0] : event.entity;
  const title = `${event.name} — ${event.venue_name}, ${event.city} fan footage`;
  const description = `Fan-shot photos and videos from ${entity?.name ?? 'the show'} at ${event.venue_name} on ${formatEventDate(event.event_date)}.`;
  const canonical = entity ? `/${entity.slug}/${event.slug}` : undefined;
  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function EventPage({
  params,
  searchParams,
}: {
  params: { entitySlug: string; eventSlug: string };
  searchParams: { tab?: string; filter?: string; section?: string; song?: string };
}) {
  const event = await fetchEvent(params.eventSlug);
  if (!event) notFound();
  const entity = Array.isArray(event.entity) ? event.entity[0] : event.entity;
  if (!entity || entity.slug !== params.entitySlug) notFound();

  const tab: Tab =
    searchParams.tab === 'browse'
      ? 'browse'
      : searchParams.tab === 'upload'
        ? 'upload'
        : 'watch';

  const supabase = createAdminClient();

  // Pull media for Watch tab setlist counts + contributor count.
  const { data: rawMedia } = await supabase
    .from('media')
    .select(
      'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, section_tag, caption, view_count, like_count, is_full_song, uploader_id, upload_session, created_at',
    )
    .eq('event_id', event.id)
    .eq('status', 'active')
    .order('view_count', { ascending: false })
    .limit(100);

  const allMedia = (rawMedia ?? []) as unknown as EventMedia[];

  // Contributors = distinct uploader_id + distinct upload_session for anon.
  const contribKeys = new Set<string>();
  for (const m of allMedia) {
    if (m.uploader_id) contribKeys.add(`u:${m.uploader_id}`);
    else if (m.upload_session) contribKeys.add(`s:${m.upload_session}`);
  }

  // Browse tab: first page (24 items) with DB-side filter for the client component.
  const BROWSE_PAGE = 24;
  let browseInitialItems: MediaCardData[] = [];
  let browseNextCursor: string | null = null;

  if (tab === 'browse') {
    let browseQ = supabase
      .from('media')
      .select(
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, section_tag, caption, view_count, like_count, is_full_song, uploader_id, upload_session, created_at',
      )
      .eq('event_id', event.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(BROWSE_PAGE + 1);

    const browseFilter = searchParams.filter ?? '';
    const browseSection = searchParams.section ?? '';
    if (browseFilter === 'photos') browseQ = browseQ.eq('file_type', 'photo');
    if (browseFilter === 'videos') browseQ = browseQ.eq('file_type', 'video');
    if (browseSection && (SECTION_ORDER as string[]).includes(browseSection)) {
      browseQ = browseQ.eq('section_tag', browseSection);
    }

    const { data: browseRaw } = await browseQ;
    const browseRows = (browseRaw ?? []) as unknown as Array<MediaCardData & { created_at: string }>;
    const hasMore = browseRows.length > BROWSE_PAGE;
    browseInitialItems = hasMore ? browseRows.slice(0, BROWSE_PAGE) : browseRows;
    const last = browseInitialItems[browseInitialItems.length - 1] as (MediaCardData & { created_at: string }) | undefined;
    if (hasMore && last) {
      browseNextCursor = Buffer.from(
        JSON.stringify({ created_at: last.created_at, id: last.id }),
      ).toString('base64url');
    }
  }

  // Attendance: total count + whether the current user (if any) attended.
  const currentUser = await getCurrentUser();
  const [{ count: attendeeCount }, ownAttendance] = await Promise.all([
    supabase
      .from('attended_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id),
    currentUser
      ? supabase
          .from('attended_events')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('event_id', event.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const initiallyAttending = !!ownAttendance?.data;

  // Setlist with per-song clip counts.
  const setlistCounts = new Map<string, number>();
  for (const m of allMedia) {
    if (m.song_tag) setlistCounts.set(m.song_tag, (setlistCounts.get(m.song_tag) ?? 0) + 1);
  }
  const setlist = Array.isArray(event.setlist) ? event.setlist : [];

  // Section counts (computed from allMedia — approximate for large events).
  const sectionCounts: Record<string, number> = {};
  for (const m of allMedia) {
    if (m.section_tag) {
      sectionCounts[m.section_tag] = (sectionCounts[m.section_tag] ?? 0) + 1;
    }
  }

  const baseUrl = `/${entity.slug}/${event.slug}`;

  // Abbreviated date for breadcrumb e.g. "Boston, May 10 2026"
  const shortDate = new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-ash bg-smoke/40">
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-0">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Link href={`/${entity.slug}`} className="hover:text-white transition">
              ← {entity.name}
            </Link>
            <span>/</span>
            <span>{event.city}, {shortDate}</span>
          </div>

          {/* Eyebrow — tour name if set, else entity name */}
          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-red-500">
            // {(event.tour_name ?? entity.name).toUpperCase()}
          </p>

          {/* H1 */}
          <h1 className="mt-1 font-display text-4xl font-black leading-tight md:text-5xl lg:text-6xl">
            {event.venue_name}
            <span className="text-white/30"> · </span>
            {event.city}
          </h1>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
                <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
                <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
              </svg>
              {formatEventDate(event.event_date)}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeWidth="2" />
                <circle cx="12" cy="10" r="3" strokeWidth="2" />
              </svg>
              {event.city}{event.state ? `, ${event.state}` : ''}
            </span>
          </div>

          {/* Stats row */}
          <div className="mt-6 flex items-stretch divide-x divide-white/10">
            <EventStat label="Clips" value={event.upload_count} />
            <EventStat label="Contributors" value={contribKeys.size} />
            <EventStat label="Attendance" value={attendeeCount ?? 0} attendance>
              <AttendanceButton
                eventId={event.id}
                eventUrl={baseUrl}
                initiallyAttending={initiallyAttending}
                initialCount={attendeeCount ?? 0}
                isAuthed={!!currentUser}
              />
            </EventStat>
          </div>

          {/* Tab bar */}
          <div className="mt-8 flex gap-0">
            <TabLink href={baseUrl} active={tab === 'watch'} sub="curated experience">
              Watch
            </TabLink>
            <TabLink
              href={`${baseUrl}?tab=browse`}
              active={tab === 'browse'}
              sub={`all ${formatCount(event.upload_count)} uploads`}
            >
              Browse
            </TabLink>
            <TabLink href={`${baseUrl}?tab=upload`} active={tab === 'upload'} sub="add your clips">
              Upload
            </TabLink>
          </div>
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-12">
        {tab === 'watch' ? (
          <WatchTab
            baseUrl={baseUrl}
            allMedia={allMedia}
            setlist={setlist}
            setlistCounts={setlistCounts}
            activeSong={searchParams.song}
            totalUploads={event.upload_count}
          />
        ) : null}
        {tab === 'upload' ? (
          <UploadTabContent event={event} entity={entity} />
        ) : null}
        {tab === 'browse' ? (
          <BrowseTabShell
            baseUrl={baseUrl}
            filter={searchParams.filter}
            section={searchParams.section as SectionTag | undefined}
            totalCount={event.upload_count}
            videoCount={event.video_count}
            photoCount={event.photo_count}
            sectionCounts={sectionCounts}
          >
            <BrowseGrid
              initialItems={browseInitialItems}
              initialCursor={browseNextCursor}
              eventSlug={event.slug}
              filter={searchParams.filter}
              section={searchParams.section}
            />
          </BrowseTabShell>
        ) : null}
      </main>

      {tab !== 'upload' && <UploadButton eventSlug={event.slug} />}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: event.name,
            startDate: event.event_date,
            eventStatus: 'https://schema.org/EventScheduled',
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            location: {
              '@type': 'Place',
              name: event.venue_name,
              address: {
                '@type': 'PostalAddress',
                addressLocality: event.city,
                ...(event.state ? { addressRegion: event.state } : {}),
                addressCountry: 'US',
              },
            },
            ...(entity
              ? {
                  performer: {
                    '@type': entity ? 'PerformingGroup' : 'Organization',
                    name: entity.name,
                    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${entity.slug}`,
                  },
                }
              : {}),
            url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${entity?.slug ?? ''}/${event.slug}`,
          }),
        }}
      />
      <Footer />
    </div>
  );
}

// ── Header sub-components ────────────────────────────────────────────────────

function EventStat({
  label,
  value,
  attendance,
  children,
}: {
  label: string;
  value: number;
  attendance?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col justify-between pr-8 ${attendance ? 'pl-8' : 'pr-8'} first:pl-0 last:pr-0`}>
      <div>
        <div className="text-2xl font-semibold tabular-nums leading-none">
          {formatCount(value)}
        </div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          {label}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function TabLink({
  href,
  active,
  sub,
  children,
}: {
  href: string;
  active: boolean;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group -mb-px border-b-2 px-5 py-3 transition ${
        active ? 'border-white' : 'border-transparent hover:border-white/30'
      }`}
    >
      <span
        className={`block text-sm font-semibold ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}
      >
        {children}
      </span>
      <span className="block text-[10px] text-gray-600">{sub}</span>
    </Link>
  );
}

// ── Watch tab ────────────────────────────────────────────────────────────────

function WatchTab({
  baseUrl,
  allMedia,
  setlist,
  setlistCounts,
  activeSong,
  totalUploads,
}: {
  baseUrl: string;
  allMedia: EventMedia[];
  setlist: string[];
  setlistCounts: Map<string, number>;
  activeSong?: string;
  totalUploads: number;
}) {
  // Featured = top video by view_count with a playback ID.
  const featured =
    allMedia.find((m) => m.file_type === 'video' && m.mux_playback_id) ?? null;

  // Up-next: other playable videos (up to 12).
  const upNext = allMedia
    .filter((m) => m.id !== featured?.id && m.file_type === 'video' && m.mux_playback_id)
    .slice(0, 12);

  // Default song for browser: activeSong param, else first setlist song with clips.
  const displaySong =
    activeSong ??
    setlist.find((s) => (setlistCounts.get(s) ?? 0) > 0) ??
    null;

  const songClips = displaySong
    ? allMedia
        .filter((m) => m.song_tag === displaySong)
        .sort((a, b) => b.view_count - a.view_count)
    : [];

  const songIndex = displaySong ? setlist.indexOf(displaySong) : -1;

  const SETLIST_PREVIEW = 12;

  if (allMedia.length === 0) {
    return (
      <div className="rounded-lg border border-ash bg-smoke p-10 text-center">
        <p className="text-lg font-semibold">No clips yet</p>
        <p className="mt-1 text-sm text-gray-400">Be the first to share something from this show.</p>
        <Link
          href={`/upload/${baseUrl.split('/')[2]}`}
          className="mt-4 inline-block rounded bg-croll px-4 py-2 text-sm font-semibold text-ink"
        >
          Upload now
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">

      {/* ── Featured player ── */}
      {featured?.mux_playback_id && (
        <section>
          {/* Player */}
          <div className="relative overflow-hidden rounded-xl bg-black">
            {/* Badge */}
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Most viewed · {formatCount(featured.view_count)} views
            </div>
            <VideoPlayer
              playbackId={featured.mux_playback_id}
              poster={featured.thumbnail_url ?? undefined}
            />
          </div>

          {/* Metadata strip below player */}
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {/* Tags */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {featured.section_tag && (
                  <span className="rounded border border-ash px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {SECTION_LABELS[featured.section_tag]}
                  </span>
                )}
                {featured.song_tag && (
                  <span className="rounded border border-ash px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {featured.song_tag}
                  </span>
                )}
              </div>
              {/* Caption */}
              {featured.caption && (
                <p className="text-lg font-semibold leading-snug md:text-xl">
                  &ldquo;{featured.caption}&rdquo;
                </p>
              )}
              {/* Uploader + meta */}
              <p className="mt-1.5 text-xs text-gray-500">
                uploaded by{' '}
                <span className="text-gray-400">
                  @{featured.uploader_id ? featured.uploader_id.slice(0, 8) : 'anon'}
                </span>
                {' · '}
                {timeAgo(featured.created_at)}
                {' · '}
                {formatCount(featured.view_count)} views
              </p>
            </div>
            {/* Like + share */}
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {formatCount(featured.like_count)}
              </span>
              <button className="rounded border border-ash px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-ash hover:text-white">
                ↗ Share
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Up next horizontal scroll ── */}
      {upNext.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Up next from this show</h2>
            <span className="text-xs text-gray-500">{formatCount(totalUploads)} total uploads</span>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3">
            {upNext.map((m) => (
              <UpNextCard key={m.id} media={m} />
            ))}
          </div>
        </section>
      )}

      {/* ── Song browser ── */}
      {setlist.length > 0 && (
        <section>
          {/* Section eyebrow */}
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-red-500">
            // STEP THROUGH THE SHOW
          </p>
          <h2 className="mt-1 font-heading text-2xl font-bold md:text-3xl">
            Browse the night, song by song.
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
            {/* Left: setlist */}
            <div>
              <ol className="divide-y divide-white/5 overflow-hidden rounded-lg border border-ash">
                {setlist.slice(0, SETLIST_PREVIEW).map((song, i) => {
                  const count = setlistCounts.get(song) ?? 0;
                  const isActive = displaySong === song;
                  const hasClips = count > 0;
                  return (
                    <li key={`${song}-${i}`}>
                      <Link
                        href={hasClips ? `${baseUrl}?song=${encodeURIComponent(song)}` : '#'}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                          isActive
                            ? 'bg-white/10 text-white'
                            : hasClips
                              ? 'text-gray-300 hover:bg-white/5 hover:text-white'
                              : 'cursor-default text-gray-700'
                        }`}
                      >
                        {/* Number */}
                        <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-gray-600">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {/* Name */}
                        <span className="flex-1 truncate font-medium">{song}</span>
                        {/* Clip count */}
                        <span
                          className={`shrink-0 text-[11px] tabular-nums ${
                            isActive ? 'font-semibold text-croll' : 'text-gray-600'
                          }`}
                        >
                          {count > 0 ? `${count} clips` : '—'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>

              {setlist.length > SETLIST_PREVIEW && (
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-600">
                  <span>+ {setlist.length - SETLIST_PREVIEW} more songs</span>
                  <Link
                    href={`${baseUrl}?tab=browse`}
                    className="hover:text-gray-300 transition"
                  >
                    view full setlist →
                  </Link>
                </div>
              )}

              {activeSong && (
                <div className="mt-3">
                  <Link href={baseUrl} className="text-[11px] text-gray-500 hover:text-white transition">
                    ← clear filter
                  </Link>
                </div>
              )}
            </div>

            {/* Right: clips for active song */}
            {displaySong && songClips.length > 0 ? (
              <div>
                {/* Header */}
                <div className="mb-4">
                  <h3 className="text-base font-semibold leading-snug">
                    {displaySong}
                    <span className="text-white/40"> · </span>
                    <span className="font-normal text-gray-400">
                      {songClips.length} clips from this song tonight
                    </span>
                  </h3>
                  {songIndex >= 0 && (
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-gray-600">
                      SONG {songIndex + 1}
                    </p>
                  )}
                </div>
                {/* 2×2 grid */}
                <div className="grid grid-cols-2 gap-2">
                  {songClips.slice(0, 4).map((m) => (
                    <SongClipThumb key={m.id} media={m} />
                  ))}
                </div>
                {songClips.length > 4 && (
                  <Link
                    href={`${baseUrl}?tab=browse`}
                    className="mt-3 block text-center text-xs text-gray-500 hover:text-white transition"
                  >
                    View all {songClips.length} clips →
                  </Link>
                )}
              </div>
            ) : displaySong ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-ash py-16 text-sm text-gray-600">
                No clips yet for this song
              </div>
            ) : null}
          </div>
        </section>
      )}

      {/* If no setlist, show a flat grid of clips */}
      {setlist.length === 0 && allMedia.length > 0 && (
        <section>
          <h2 className="mb-4 font-semibold">Fan highlights</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {allMedia.map((m) => (
              <MediaCard key={m.id} media={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Up Next card ─────────────────────────────────────────────────────────────

function UpNextCard({ media }: { media: EventMedia }) {
  const thumb = media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const dur = fmtDuration(media.duration_sec);
  const sectionLabel = media.section_tag ? SECTION_LABELS[media.section_tag] : null;

  return (
    <div className="w-52 shrink-0 overflow-hidden rounded-lg bg-smoke">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-ash">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        )}
        {/* Overlay: section tag + duration */}
        <div className="absolute inset-0 flex items-start justify-between p-2">
          {sectionLabel && (
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              {sectionLabel}
            </span>
          )}
          {dur && (
            <span className="ml-auto rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-white backdrop-blur-sm">
              {dur}
            </span>
          )}
        </div>
        {/* Play button */}
        {media.file_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <svg className="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}
      </div>
      {/* Meta */}
      <div className="px-2.5 py-2">
        {media.song_tag && (
          <p className="truncate text-[11px] font-medium text-white">{media.song_tag}</p>
        )}
        <p className="mt-0.5 flex items-center justify-between text-[10px] text-gray-500">
          <span>
            @{media.uploader_id ? media.uploader_id.slice(0, 8) : 'anon'}
          </span>
          <span>{formatCount(media.view_count)} views</span>
        </p>
      </div>
    </div>
  );
}

// ── Song clip thumbnail ───────────────────────────────────────────────────────

function SongClipThumb({ media }: { media: EventMedia }) {
  const thumb = media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const dur = fmtDuration(media.duration_sec);
  const sectionLabel = media.section_tag ? SECTION_LABELS[media.section_tag] : null;

  return (
    <div className="group overflow-hidden rounded-lg bg-ash">
      {/* Thumbnail */}
      <div className="relative aspect-video">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-smoke">
            <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        )}
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-0 flex items-start justify-between p-2">
          {sectionLabel && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
              {sectionLabel}
            </span>
          )}
          {dur && (
            <span className="ml-auto rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white">
              {dur}
            </span>
          )}
        </div>
        {/* Play */}
        {media.file_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
              <svg className="ml-0.5 h-4 w-4 text-ink" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}
        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="flex items-center justify-between text-[10px] text-white/70">
            <span>@{media.uploader_id ? media.uploader_id.slice(0, 8) : 'anon'}</span>
            <span>{formatCount(media.view_count)} views</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Upload tab ────────────────────────────────────────────────────────────────

function UploadTabContent({
  event,
  entity,
}: {
  event: EventRow;
  entity: { id: string; slug: string; name: string };
}) {
  const shortDate = new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const preselectedEvent: EventOption = {
    id: event.id,
    slug: event.slug,
    name: event.name,
    venue_name: event.venue_name,
    city: event.city,
    state: event.state,
    event_date: event.event_date,
    entity: { slug: entity.slug, name: entity.name },
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-ash/50 bg-smoke/30">
        {/* Card header */}
        <div className="border-b border-ash/50 px-8 pt-8 pb-6">
          <h2 className="text-xl font-semibold">Add your clips from this show</h2>
          <p className="mt-1 text-sm text-gray-500">
            {event.venue_name} &middot; {event.city}{event.state ? `, ${event.state}` : ''} &middot; {shortDate}.{' '}
            <span className="text-gray-600">No account needed.</span>
          </p>
        </div>

        {/* Upload flow embedded */}
        <div className="px-8 py-6">
          <UploadFlow initialEvent={preselectedEvent} />
        </div>
      </div>
    </div>
  );
}

// ── Browse tab shell ──────────────────────────────────────────────────────────

function BrowseTabShell({
  baseUrl,
  filter,
  section,
  totalCount,
  videoCount,
  photoCount,
  sectionCounts,
  children,
}: {
  baseUrl: string;
  filter?: string;
  section?: SectionTag;
  totalCount: number;
  videoCount: number;
  photoCount: number;
  sectionCounts: Record<string, number>;
  children: React.ReactNode;
}) {
  function mkHref(overrides: { filter?: string | null; section?: string | null }) {
    const f = overrides.filter !== undefined ? overrides.filter : filter;
    const s = overrides.section !== undefined ? overrides.section : section;
    const sp = new URLSearchParams({ tab: 'browse' });
    if (f) sp.set('filter', f);
    if (s) sp.set('section', s);
    return `${baseUrl}?${sp.toString()}`;
  }

  // Only show section pills that have at least 1 item.
  const activeSections = SECTION_ORDER.filter((s) => (sectionCounts[s] ?? 0) > 0);

  return (
    <div className="space-y-4">
      {/* Horizontally scrollable filter row */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex items-center gap-1.5" style={{ minWidth: 'max-content' }}>
          <FilterPill href={mkHref({ filter: null, section: null })} active={!filter && !section}>
            All <CountBadge active={!filter && !section}>{formatCount(totalCount)}</CountBadge>
          </FilterPill>
          <FilterPill href={mkHref({ filter: 'videos', section: null })} active={filter === 'videos' && !section}>
            Videos <CountBadge active={filter === 'videos' && !section}>{formatCount(videoCount)}</CountBadge>
          </FilterPill>
          <FilterPill href={mkHref({ filter: 'photos', section: null })} active={filter === 'photos' && !section}>
            Photos <CountBadge active={filter === 'photos' && !section}>{formatCount(photoCount)}</CountBadge>
          </FilterPill>

          {activeSections.length > 0 && (
            <span className="mx-1 h-4 w-px shrink-0 bg-white/10" />
          )}

          {activeSections.map((s) => {
            const isActive = section === s;
            return (
              <FilterPill key={s} href={mkHref({ section: s, filter: null })} active={isActive}>
                {SECTION_LABELS[s]}
                <CountBadge active={isActive}>{sectionCounts[s]}</CountBadge>
              </FilterPill>
            );
          })}

          <span className="mx-1 h-4 w-px shrink-0 bg-white/10" />

          <FilterPill href={baseUrl} active={false}>
            By song
          </FilterPill>
        </div>
      </div>

      {children}
    </div>
  );
}

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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-white text-ink'
          : 'border border-ash text-gray-400 hover:border-gray-500 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

function CountBadge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={`tabular-nums ${active ? 'text-ink/60' : 'text-gray-600'}`}>
      {children}
    </span>
  );
}
