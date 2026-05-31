// /[entitySlug]/[eventSlug] — event page.
//
// Two tabs (URL-driven, not client state):
//   ?tab=browse (default)  — left-rail setlist + section filters, mosaic grid,
//                            inline-expand on click. All filtering client-side.
//   ?tab=upload            — inline upload flow with event preselected.
//
// The page fetches up to 500 active media rows for the event in one go and
// hands the array to <EventBrowse /> which handles filter/sort/expand state.

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { UploadButton } from '@/components/upload-button';
import { Footer } from '@/components/footer';
import { AttendanceButton } from '@/components/attendance-button';
import { type SectionTag } from '@/lib/types';
import { formatEventDate, formatCount } from '@/components/format';
import { UploadFlow, type EventOption } from '@/app/upload/upload-flow';
import { EventBrowse, type EventBrowseMedia } from './event-browse';

export const dynamic = 'force-dynamic';

type Tab = 'browse' | 'upload';


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
  entity: { id: string; slug: string; name: string; hero_image_url: string | null } | { id: string; slug: string; name: string; hero_image_url: string | null }[] | null;
}

type EventMedia = EventBrowseMedia & { upload_session: string | null };

async function fetchEvent(eventSlug: string): Promise<EventRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('events')
    .select(
      'id, entity_id, slug, name, venue_name, city, state, event_date, tour_name, setlist, upload_count, photo_count, video_count, entity:entities(id, slug, name, hero_image_url)',
    )
    .eq('slug', eventSlug)
    .eq('hidden', false)
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

  const tab: Tab = searchParams.tab === 'upload' ? 'upload' : 'browse';

  const supabase = createAdminClient();

  // Pull all active media for the event in one go — client filters/sorts in JS.
  // Cap at 500 to bound payload size; events with more than 500 active clips
  // will need pagination in V2.
  const { data: rawMedia } = await supabase
    .from('media')
    .select(
      'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, song_tag_source, section_tag, caption, view_count, like_count, is_full_song, uploader_id, upload_session, created_at',
    )
    .eq('event_id', event.id)
    .eq('status', 'active')
    .order('view_count', { ascending: false })
    .limit(500);

  const allMedia = (rawMedia ?? []) as unknown as EventMedia[];

  // Contributors = distinct uploader_id + distinct upload_session for anon.
  const contribKeys = new Set<string>();
  for (const m of allMedia) {
    if (m.uploader_id) contribKeys.add(`u:${m.uploader_id}`);
    else if (m.upload_session) contribKeys.add(`s:${m.upload_session}`);
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

  const setlist = Array.isArray(event.setlist) ? event.setlist : [];
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
        <div className="mx-auto max-w-7xl px-4 pt-5 pb-0">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Link href={`/${entity.slug}`} className="hover:text-white transition">
              ← {entity.name}
            </Link>
            <span>/</span>
            <span>{event.city}, {shortDate}</span>
          </div>

          {/* Title block (left) + stats (right) */}
          <div className="mt-3 grid items-start gap-x-8 gap-y-5 lg:grid-cols-[1fr_auto]">
            <div className="flex min-w-0 items-start gap-4">
              {/* Entity hero thumbnail */}
              {entity.hero_image_url ? (
                <Link href={`/${entity.slug}`} className="shrink-0">
                  <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-smoke md:h-16 md:w-16">
                    <Image
                      src={entity.hero_image_url}
                      alt={entity.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </Link>
              ) : null}
            <div className="min-w-0">
              {/* Eyebrow — tour name if set, else entity name */}
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-croll">
                // {(event.tour_name ?? entity.name).toUpperCase()}
              </p>

              {/* H1 */}
              <h1 className="mt-1 font-display text-2xl font-black leading-tight md:text-3xl lg:text-4xl">
                {event.venue_name}
                <span className="text-white/30"> · </span>
                {event.city}
              </h1>

              {/* Meta row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-400">
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
            </div>
            </div>

            {/* Stats row — desktop: top-right with button inside Attendance col */}
            <div className="hidden items-stretch divide-x divide-white/10 md:flex lg:justify-end">
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

            {/* Stats + attendance — mobile: single row, attendance col has inline button */}
            <div className="grid grid-cols-3 divide-x divide-white/10 md:hidden">
              <div className="flex flex-col py-2">
                <span className="text-[20px] font-medium tabular-nums leading-none">{formatCount(event.upload_count)}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Clips</span>
              </div>
              <div className="flex flex-col items-center py-2">
                <span className="text-[20px] font-medium tabular-nums leading-none">{formatCount(contribKeys.size)}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Contributors</span>
              </div>
              <div className="flex flex-col items-end py-2">
                <span className="text-[20px] font-medium tabular-nums leading-none">{formatCount(attendeeCount ?? 0)}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Attendance</span>
                <AttendanceButton
                  eventId={event.id}
                  eventUrl={baseUrl}
                  initiallyAttending={initiallyAttending}
                  initialCount={attendeeCount ?? 0}
                  isAuthed={!!currentUser}
                  compact
                />
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-6 flex gap-0">
            <TabLink
              href={baseUrl}
              active={tab === 'browse'}
              sub={`${formatCount(event.upload_count)} uploads`}
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
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-12">
        {tab === 'browse' ? (
          <EventBrowse media={allMedia} setlist={setlist} eventName={event.name} eventDate={event.event_date} />
        ) : (
          <UploadTabContent event={event} entity={entity} />
        )}
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
    <div className="flex flex-col justify-between px-6 first:pl-0 last:pr-0">
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

