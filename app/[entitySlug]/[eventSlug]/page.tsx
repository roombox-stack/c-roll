// /[entitySlug]/[eventSlug] — event page.
//
// Three tabs (URL-driven, not client state):
//   ?tab=watch (default)  — featured player + setlist song nav + highlights grid
//   ?tab=browse           — photo/video + section filters, infinite-scroll grid
//   ?tab=upload           — link out to /upload/[slug] (full inline flow in Phase 5)
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
      'id, entity_id, slug, name, venue_name, city, state, event_date, setlist, upload_count, photo_count, video_count, entity:entities(id, slug, name)',
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
    searchParams.tab === 'browse' || searchParams.tab === 'upload' ? searchParams.tab : 'watch';

  const supabase = createAdminClient();

  // Pull media for Watch tab setlist counts + contributor count.
  // (Browse tab fetches its own paginated first page below.)
  const { data: rawMedia } = await supabase
    .from('media')
    .select(
      'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, section_tag, caption, view_count, like_count, is_full_song, created_at, upload_session, uploader_id',
    )
    .eq('event_id', event.id)
    .eq('status', 'active')
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
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, section_tag, caption, view_count, like_count, is_full_song, created_at',
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

  // Setlist with per-song clip counts (only meaningful if event has a setlist).
  const setlistCounts = new Map<string, number>();
  for (const m of allMedia) {
    if (m.song_tag) setlistCounts.set(m.song_tag, (setlistCounts.get(m.song_tag) ?? 0) + 1);
  }
  const setlist = Array.isArray(event.setlist) ? event.setlist : [];

  const baseUrl = `/${entity.slug}/${event.slug}`;

  return (
    <div className="min-h-screen bg-ink pb-24 text-white md:pb-0">
      <Nav />

      <section className="border-b border-ash bg-smoke">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link href={`/${entity.slug}`} className="text-sm text-gray-400 hover:text-white">
            ← {entity.name}
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{event.name}</h1>
          <p className="mt-1 text-gray-400">
            {event.venue_name}, {event.city}
            {event.state ? `, ${event.state}` : ''} · {formatEventDate(event.event_date)}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Uploads" value={event.upload_count} />
            <Stat label="Videos" value={event.video_count} />
            <Stat label="Photos" value={event.photo_count} />
            <Stat label="Contributors" value={contribKeys.size} />
          </div>

          <div className="mt-5">
            <AttendanceButton
              eventId={event.id}
              eventUrl={baseUrl}
              initiallyAttending={initiallyAttending}
              initialCount={attendeeCount ?? 0}
              isAuthed={!!currentUser}
            />
          </div>

          <div className="mt-6 flex gap-1 border-b border-ash">
            <TabLink href={baseUrl} active={tab === 'watch'}>
              Watch
            </TabLink>
            <TabLink href={`${baseUrl}?tab=browse`} active={tab === 'browse'}>
              Browse
            </TabLink>
            <TabLink href={`/upload/${event.slug}`} active={false}>
              Upload
            </TabLink>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {tab === 'watch' ? (
          <WatchTab
            baseUrl={baseUrl}
            allMedia={allMedia}
            setlist={setlist}
            setlistCounts={setlistCounts}
            activeSong={searchParams.song}
          />
        ) : null}
        {tab === 'browse' ? (
          <BrowseTabShell
            baseUrl={baseUrl}
            filter={searchParams.filter}
            section={searchParams.section as SectionTag | undefined}
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

      <UploadButton eventSlug={event.slug} />

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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{formatCount(value)}</div>
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
    </div>
  );
}

function TabLink({
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
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-white text-white'
          : 'border-transparent text-gray-400 hover:text-white'
      }`}
    >
      {children}
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
}: {
  baseUrl: string;
  allMedia: EventMedia[];
  setlist: string[];
  setlistCounts: Map<string, number>;
  activeSong?: string;
}) {
  // Featured = top video by view_count (fall back to top media by like_count).
  const featured =
    allMedia
      .filter((m) => m.file_type === 'video' && m.mux_playback_id)
      .sort((a, b) => b.view_count - a.view_count)[0] ?? null;

  // Grid: filter by activeSong if provided. When a song filter is active we
  // surface full-song video captures first (viewers searching by song usually
  // want the complete take), then fall back to like_count desc. Without a song
  // filter we just sort by likes.
  const grid = allMedia
    .filter((m) => !activeSong || m.song_tag === activeSong)
    .sort((a, b) => {
      if (activeSong && a.is_full_song !== b.is_full_song) {
        return a.is_full_song ? -1 : 1;
      }
      return b.like_count - a.like_count;
    });

  // Other clips (horizontal scroll under the featured player).
  const otherClips = allMedia
    .filter((m) => m.id !== featured?.id && m.file_type === 'video' && m.mux_playback_id)
    .slice(0, 10);

  return (
    <div className="space-y-12">
      {featured?.mux_playback_id ? (
        <section>
          <div className="rounded-lg overflow-hidden bg-black">
            <VideoPlayer
              playbackId={featured.mux_playback_id}
              poster={featured.thumbnail_url ?? undefined}
            />
          </div>
          {(featured.caption || featured.song_tag) && (
            <p className="mt-2 text-sm text-gray-300">
              {featured.song_tag ?? featured.caption}
            </p>
          )}
        </section>
      ) : null}

      {otherClips.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            More clips from this show
          </h2>
          <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-2">
            {otherClips.map((m) => (
              <MediaCard key={m.id} media={m} size="sm" />
            ))}
          </div>
        </section>
      ) : null}

      {setlist.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Browse by song</h2>
          <ol className="overflow-hidden rounded-lg border border-ash">
            {setlist.map((song, i) => {
              const count = setlistCounts.get(song) ?? 0;
              const enabled = count > 0;
              return (
                <li key={`${song}-${i}`} className="border-b border-ash last:border-b-0">
                  <Link
                    href={
                      enabled
                        ? `${baseUrl}?song=${encodeURIComponent(song)}`
                        : '#'
                    }
                    className={`flex items-center justify-between px-4 py-2 text-sm ${
                      activeSong === song
                        ? 'bg-ash text-white'
                        : enabled
                          ? 'bg-smoke text-gray-200 hover:bg-ash'
                          : 'bg-smoke text-gray-600'
                    }`}
                  >
                    <span>
                      <span className="mr-3 inline-block w-6 text-right text-xs text-gray-500">
                        {i + 1}.
                      </span>
                      {song}
                    </span>
                    <span className="text-xs tabular-nums text-gray-400">
                      {count} {count === 1 ? 'clip' : 'clips'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {activeSong ? (
            <div className="mt-3">
              <Link href={baseUrl} className="text-xs text-gray-400 hover:text-white">
                ← Clear song filter
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          {activeSong ? `Clips of “${activeSong}”` : 'Fan highlights'}
        </h2>
        {grid.length === 0 ? (
          <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
            No clips uploaded yet. Be the first to share something from this show.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {grid.map((m) => (
              <MediaCard key={m.id} media={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Browse tab shell (filter pills only — grid is client-rendered) ───────────

function BrowseTabShell({
  baseUrl,
  filter,
  section,
  children,
}: {
  baseUrl: string;
  filter?: string;
  section?: SectionTag;
  children: React.ReactNode;
}) {
  const params = (overrides: { filter?: string | null; section?: string | null }) => {
    const f = overrides.filter !== undefined ? overrides.filter : filter;
    const s = overrides.section !== undefined ? overrides.section : section;
    const sp = new URLSearchParams({ tab: 'browse' });
    if (f) sp.set('filter', f);
    if (s) sp.set('section', s);
    return `${baseUrl}?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Pill href={params({ filter: null })} active={!filter}>All</Pill>
          <Pill href={params({ filter: 'photos' })} active={filter === 'photos'}>Photos</Pill>
          <Pill href={params({ filter: 'videos' })} active={filter === 'videos'}>Videos</Pill>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-ash pt-3">
          <Pill href={params({ section: null })} active={!section}>All sections</Pill>
          {SECTION_ORDER.map((s) => (
            <Pill key={s} href={params({ section: s })} active={section === s}>
              {SECTION_LABELS[s]}
            </Pill>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

function Pill({
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-white text-ink'
          : 'border border-ash text-gray-300 hover:bg-ash hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}
