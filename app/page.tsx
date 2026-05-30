// / — C-Roll homepage (trailer direction).
//
// Cold first impression for someone who has never heard of C-Roll. Explains
// the product through content, not description. All counts and lists are
// pulled live from Supabase on each render.

import Link from 'next/link';
import Image from 'next/image';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { FollowButton } from '@/components/follow-button';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { formatCount, formatEventDate, formatDuration } from '@/components/format';
import {
  ENTITY_TYPE_LABELS,
  SECTION_LABELS,
  type EntityType,
  type SectionTag,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────────

interface TrendingMedia {
  id: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  song_tag: string | null;
  caption: string | null;
  view_count: number;
  event: {
    venue_name: string;
    city: string;
    event_date: string;
    entity: { slug: string; name: string } | { slug: string; name: string }[] | null;
  } | null;
}

interface CalendarEvent {
  id: string;
  slug: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  upload_count: number;
  entity: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

interface HomeEntity {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  follower_count: number;
  hero_image_url: string | null;
}

interface FeaturedEvent {
  id: string;
  slug: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  tour_name: string | null;
  setlist: string[] | null;
  upload_count: number;
  entity: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

interface FeaturedMedia {
  id: string;
  file_type: 'photo' | 'video';
  thumbnail_url: string | null;
  storage_url: string;
  duration_sec: number | null;
  song_tag: string | null;
  section_tag: SectionTag | null;
  view_count: number;
  uploader_id: string | null;
  upload_session: string | null;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function cleanLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t.startsWith('untitled')) return null;
  return s.trim();
}

function firstEntity<T extends { slug: string; name: string }>(
  e: T | T[] | null | undefined,
): T | null {
  if (!e) return null;
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = createAdminClient();

  const today = new Date();
  const todayISO = isoDate(today);
  const tomorrowISO = isoDate(new Date(today.getTime() + 86_400_000));
  const weekEndISO = isoDate(new Date(today.getTime() + 7 * 86_400_000));
  const wrappedStartISO = isoDate(new Date(today.getTime() - 5 * 86_400_000));

  const [
    entitiesCountRes,
    eventsCountRes,
    mediaCountRes,
    todayEventsCountRes,
    trendingRes,
    calendarRes,
    topEntitiesRes,
    featuredEventRes,
  ] = await Promise.all([
    supabase.from('entities').select('*', { count: 'exact', head: true }).eq('hidden', false),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('hidden', false),
    supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('hidden', false)
      .eq('event_date', todayISO),

    supabase
      .from('media')
      .select(
        'id, thumbnail_url, duration_sec, song_tag, caption, view_count, event:events(venue_name, city, event_date, entity:entities(slug, name))',
      )
      .eq('status', 'active')
      .eq('file_type', 'video')
      .order('view_count', { ascending: false })
      .limit(8),

    supabase
      .from('events')
      .select(
        'id, slug, venue_name, city, state, event_date, upload_count, entity:entities(slug, name)',
      )
      .eq('hidden', false)
      .gte('event_date', wrappedStartISO)
      .lte('event_date', weekEndISO)
      .order('event_date', { ascending: true }),

    supabase
      .from('entities')
      .select('id, slug, name, type, follower_count, hero_image_url')
      .eq('hidden', false)
      .order('follower_count', { ascending: false })
      .limit(6),

    supabase
      .from('events')
      .select(
        'id, slug, venue_name, city, state, event_date, tour_name, setlist, upload_count, entity:entities(slug, name)',
      )
      .eq('hidden', false)
      .order('upload_count', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const entitiesCount = entitiesCountRes.count ?? 0;
  const eventsCount = eventsCountRes.count ?? 0;
  const clipsCount = mediaCountRes.count ?? 0;
  const todayEventsCount = todayEventsCountRes.count ?? 0;

  const trending = (trendingRes.data ?? []) as unknown as TrendingMedia[];
  const calendarEvents = (calendarRes.data ?? []) as unknown as CalendarEvent[];
  const topEntities = (topEntitiesRes.data ?? []) as HomeEntity[];

  // Which of the top-entity card slugs does the current user already follow?
  const currentUser = await getCurrentUser();
  const followingSlugs = new Set<string>();
  if (currentUser && topEntities.length > 0) {
    const { data: followRows } = await supabase
      .from('follows')
      .select('entity_id')
      .eq('user_id', currentUser.id)
      .in('entity_id', topEntities.map((e) => e.id));
    const followedIds = new Set(
      (followRows ?? []).map((r) => (r as { entity_id: string }).entity_id),
    );
    for (const e of topEntities) {
      if (followedIds.has(e.id)) followingSlugs.add(e.slug);
    }
  }
  const featuredEvent = (featuredEventRes.data ?? null) as unknown as FeaturedEvent | null;

  // ── Calendar bucketing ────────────────────────────────────────────────────
  const tonight = calendarEvents.filter((e) => e.event_date === todayISO);
  const tomorrow = calendarEvents.filter((e) => e.event_date === tomorrowISO);
  const thisWeek = calendarEvents.filter(
    (e) => e.event_date > tomorrowISO && e.event_date <= weekEndISO,
  );
  const wrapped = calendarEvents
    .filter((e) => e.event_date >= wrappedStartISO && e.event_date < todayISO)
    .sort((a, b) => (a.event_date < b.event_date ? 1 : -1));

  // For "Just wrapped" rows we need clip count, contributor count, and last-upload time.
  const wrappedIds = wrapped.map((e) => e.id);
  const wrappedMediaMap = new Map<
    string,
    { clipCount: number; contribs: Set<string>; latest: string }
  >();
  if (wrappedIds.length > 0) {
    const { data: wrappedMediaRes } = await supabase
      .from('media')
      .select('event_id, uploader_id, upload_session, created_at')
      .in('event_id', wrappedIds)
      .eq('status', 'active');
    for (const m of (wrappedMediaRes ?? []) as Array<{
      event_id: string;
      uploader_id: string | null;
      upload_session: string | null;
      created_at: string;
    }>) {
      const bucket =
        wrappedMediaMap.get(m.event_id) ??
        { clipCount: 0, contribs: new Set<string>(), latest: '' };
      bucket.clipCount += 1;
      const key = m.uploader_id ? `u:${m.uploader_id}` : m.upload_session ? `s:${m.upload_session}` : '';
      if (key) bucket.contribs.add(key);
      if (m.created_at > bucket.latest) bucket.latest = m.created_at;
      wrappedMediaMap.set(m.event_id, bucket);
    }
  }

  // ── Featured event preview ────────────────────────────────────────────────
  let featuredHeroMedia: FeaturedMedia | null = null;
  let featuredSetlistCounts = new Map<string, number>();
  let featuredContribCount = 0;
  let featuredSectionsPresent = new Set<SectionTag>();
  if (featuredEvent) {
    const { data: fmRes } = await supabase
      .from('media')
      .select(
        'id, file_type, thumbnail_url, storage_url, duration_sec, song_tag, section_tag, view_count, uploader_id, upload_session, created_at',
      )
      .eq('event_id', featuredEvent.id)
      .eq('status', 'active')
      .limit(200);
    const fm = (fmRes ?? []) as FeaturedMedia[];
    featuredHeroMedia =
      fm
        .filter((m) => m.thumbnail_url)
        .sort((a, b) => b.view_count - a.view_count)[0] ?? null;
    const contribs = new Set<string>();
    for (const m of fm) {
      if (m.song_tag) {
        featuredSetlistCounts.set(
          m.song_tag,
          (featuredSetlistCounts.get(m.song_tag) ?? 0) + 1,
        );
      }
      if (m.section_tag) featuredSectionsPresent.add(m.section_tag);
      const key = m.uploader_id
        ? `u:${m.uploader_id}`
        : m.upload_session
          ? `s:${m.upload_session}`
          : '';
      if (key) contribs.add(key);
    }
    featuredContribCount = contribs.size;
  }

  const heroBgImage = '/hero-home.jpg';

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink">
        {heroBgImage ? (
          <Image
            src={heroBgImage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[70%_50%] md:object-right opacity-100"
            unoptimized
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-smoke via-ink to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 via-30% to-transparent to-50%" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 lg:pb-28 lg:pt-24">
          <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
            // C·ROLL · THE CROWD-VIDEO ARCHIVE
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.5rem,7vw,5.5rem)] font-black leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.7)]">
            Every event,
            <br />
            from the people
            <br />
            who were there.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-300">
            Floor pit. Sideline. Turn 3. Tens of thousands of fans pointing their cameras
            at the same moment — organized into one navigable experience.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
              Pick an event
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              What is c-roll
            </Link>
          </div>

          {todayEventsCount > 0 ? (
            <div className="mt-12 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-gray-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-croll" />
              <span className="text-croll">{todayEventsCount}</span>
              <span>
                {todayEventsCount === 1 ? 'show' : 'shows'} filmed right now · clips arrive during
                and after the show
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-24 px-4 py-20">
        {/* ── Clips everyone's watching ───────────────────────────────────── */}
        {trending.length > 0 ? (
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
                  // THERE IS NO NOWHERE
                </p>
                <h2 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">
                  The clips everyone&apos;s watching.
                </h2>
              </div>
              <Link
                href="/search"
                className="shrink-0 text-sm text-gray-500 transition hover:text-white"
              >
                Top 100 →
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {trending.map((m) => (
                <TrendingCard key={m.id} media={m} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Shows worth following along with ────────────────────────────── */}
        {(tonight.length || tomorrow.length || thisWeek.length || wrapped.length) > 0 ? (
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
                  // THIS WEEK
                </p>
                <h2 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">
                  Shows worth following along with.
                </h2>
              </div>
              <Link
                href="/search"
                className="shrink-0 text-sm text-gray-500 transition hover:text-white"
              >
                Full calendar →
              </Link>
            </div>

            <div className="mt-6 divide-y divide-white/5 border-y border-white/5">
              {tonight.length > 0 ? (
                <CalendarBucket
                  label="Tonight"
                  sublabel={formatShortDate(todayISO)}
                  events={tonight}
                  variant="upcoming"
                />
              ) : null}
              {tomorrow.length > 0 ? (
                <CalendarBucket
                  label="Tomorrow"
                  sublabel={formatShortDate(tomorrowISO)}
                  events={tomorrow}
                  variant="upcoming"
                />
              ) : null}
              {thisWeek.length > 0 ? (
                <CalendarBucket
                  label="This week"
                  sublabel={`${formatShortDate(isoDate(new Date(today.getTime() + 2 * 86_400_000)))}–${formatShortDate(weekEndISO)}`}
                  events={thisWeek}
                  variant="upcoming"
                />
              ) : null}
              {wrapped.length > 0 ? (
                <CalendarBucket
                  label="Just wrapped"
                  sublabel={formatShortDate(wrappedStartISO) + '+'}
                  events={wrapped}
                  variant="wrapped"
                  mediaMap={wrappedMediaMap}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Follow what you'd film ──────────────────────────────────────── */}
        {topEntities.length > 0 ? (
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
                  // ARTISTS · TEAMS · EVENTS
                </p>
                <h2 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">
                  Follow what you&apos;d film.
                </h2>
              </div>
              <Link
                href="/search"
                className="shrink-0 text-sm text-gray-500 transition hover:text-white"
              >
                Browse all {formatCount(entitiesCount)} →
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {topEntities.map((e) => (
                <FollowEntityCard
                  key={e.id}
                  entity={e}
                  isAuthed={!!currentUser}
                  initialFollowing={followingSlugs.has(e.slug)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── What a show looks like inside ───────────────────────────────── */}
        {featuredEvent ? (
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
                  // THE EXPERIENCE
                </p>
                <h2 className="mt-2 font-heading text-2xl font-bold text-white md:text-3xl">
                  What a show looks like inside.
                </h2>
              </div>
              <Link
                href={`/${firstEntity(featuredEvent.entity)?.slug ?? ''}/${featuredEvent.slug}`}
                className="shrink-0 text-sm text-gray-500 transition hover:text-white"
              >
                Open this show →
              </Link>
            </div>

            <FeaturedShowPreview
              event={featuredEvent}
              hero={featuredHeroMedia}
              setlistCounts={featuredSetlistCounts}
              contributorCount={featuredContribCount}
              sectionsPresent={featuredSectionsPresent}
            />
          </section>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

// ── Trending card ────────────────────────────────────────────────────────────

function TrendingCard({ media }: { media: TrendingMedia }) {
  const ent = firstEntity(media.event?.entity ?? null);
  const label = cleanLabel(media.song_tag) ?? cleanLabel(media.caption);
  return (
    <Link
      href={`/watch/${media.id}`}
      className="group block overflow-hidden rounded-lg bg-smoke transition hover:scale-[1.02]"
    >
      <div className="relative aspect-video bg-black">
        {media.thumbnail_url ? (
          <Image
            src={media.thumbnail_url}
            alt={label ?? ''}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        {media.duration_sec ? (
          <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
            {formatDuration(media.duration_sec)}
          </span>
        ) : null}

        {label ? (
          <span className="absolute inset-x-2 bottom-2 truncate text-[11px] font-medium text-white">
            &ldquo;{label}&rdquo;
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5 px-2.5 py-2 text-[11px]">
        {ent ? (
          <p className="truncate font-semibold text-white">{ent.name}</p>
        ) : null}
        {media.event ? (
          <p className="truncate font-mono text-[10px] text-gray-500">
            {media.event.venue_name} · {formatShortDate(media.event.event_date)}
          </p>
        ) : null}
        <p className="font-mono text-[10px] text-gray-600">
          {formatCount(media.view_count)} views
        </p>
      </div>
    </Link>
  );
}

// ── Calendar row ─────────────────────────────────────────────────────────────

function CalendarBucket({
  label,
  sublabel,
  events,
  variant,
  mediaMap,
}: {
  label: string;
  sublabel: string;
  events: CalendarEvent[];
  variant: 'upcoming' | 'wrapped';
  mediaMap?: Map<string, { clipCount: number; contribs: Set<string>; latest: string }>;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 py-5 md:grid-cols-[140px_1fr]">
      <div className="pt-0.5">
        <p className="font-heading text-sm font-semibold text-white">{label}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-gray-600">
          {sublabel}
        </p>
      </div>
      <ul className="space-y-2.5">
        {events.map((ev) => {
          const ent = firstEntity(ev.entity);
          const href = ent ? `/${ent.slug}/${ev.slug}` : `#`;
          const stats = mediaMap?.get(ev.id);
          return (
            <li key={ev.id}>
              <Link
                href={href}
                // Fixed-width right column keeps the venue text in the same
                // x-position whether the stats string is long ("10 clips · 1
                // contributor · 14 mins ago") or short ("0 clips"). Without
                // this, each Link is its own grid, so an auto column shrinks
                // when stats are short and shoves the venue rightward.
                className="grid grid-cols-1 items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-white/5 md:grid-cols-[1fr_1.4fr_320px] md:gap-6"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {ent?.name ?? ev.venue_name}
                  </span>
                </span>
                <span className="min-w-0 truncate font-mono text-[11px] text-gray-500">
                  {ev.venue_name}
                  {ev.city ? ` · ${ev.city}` : ''}
                </span>
                {variant === 'upcoming' ? (
                  <span className="shrink-0 text-right font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    clips arrive during and after the show
                  </span>
                ) : stats ? (
                  <span className="shrink-0 text-right font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    <span className="text-croll">
                      {formatCount(stats.clipCount)} clips
                    </span>
                    <span className="text-ash"> · </span>
                    {formatCount(stats.contribs.size)} contributors
                    {stats.latest ? (
                      <>
                        <span className="text-ash"> · </span>
                        {timeSince(stats.latest)}
                      </>
                    ) : null}
                  </span>
                ) : (
                  <span className="shrink-0 text-right font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    {formatCount(ev.upload_count)} clips
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Follow entity card ───────────────────────────────────────────────────────

function FollowEntityCard({
  entity,
  isAuthed,
  initialFollowing,
}: {
  entity: HomeEntity;
  isAuthed: boolean;
  initialFollowing: boolean;
}) {
  const typeLabel = ENTITY_TYPE_LABELS[entity.type] ?? entity.type;
  return (
    <Link
      href={`/${entity.slug}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-smoke transition hover:brightness-110"
    >
      {entity.hero_image_url ? (
        <Image
          src={entity.hero_image_url}
          alt={entity.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition group-hover:scale-105"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />

      <span className="absolute left-2.5 top-2.5 rounded bg-black/70 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-white">
        {typeLabel}
      </span>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-bold text-white">{entity.name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-gray-400">
            {formatCount(entity.follower_count)} followers
          </p>
        </div>
        <FollowButton
          entitySlug={entity.slug}
          initialFollowing={initialFollowing}
          initialFollowerCount={entity.follower_count}
          isAuthed={isAuthed}
          variant="ghost"
          showCount={false}
          className="shrink-0 !rounded-full !px-2.5 !py-1 !text-[10px] !font-semibold"
        />
      </div>
    </Link>
  );
}

// ── Featured show preview ────────────────────────────────────────────────────

function FeaturedShowPreview({
  event,
  hero,
  setlistCounts,
  contributorCount,
  sectionsPresent,
}: {
  event: FeaturedEvent;
  hero: FeaturedMedia | null;
  setlistCounts: Map<string, number>;
  contributorCount: number;
  sectionsPresent: Set<SectionTag>;
}) {
  const ent = firstEntity(event.entity);
  // Strip non-song entries (empty strings, "Play Video" placeholders) before
  // rendering — same guard as the event-page setlist rail.
  const setlist = (event.setlist ?? []).filter((s) => {
    if (typeof s !== 'string') return false;
    const t = s.trim();
    if (!t) return false;
    if (t.toLowerCase() === 'play video') return false;
    return true;
  });

  // Active row = the song in the setlist with the most clips (ties: first).
  let activeSong: string | null = null;
  let activeCount = -1;
  for (const song of setlist) {
    const c = setlistCounts.get(song) ?? 0;
    if (c > activeCount) {
      activeCount = c;
      activeSong = song;
    }
  }

  const sectionsToShow: SectionTag[] = ['floor', 'section_100', 'section_200', 'upper', 'stage_left', 'stage_right'];

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      {/* Left — hero clip preview */}
      <div className="relative overflow-hidden rounded-lg bg-black">
        <div className="relative aspect-video">
          {hero?.thumbnail_url ? (
            <Image
              src={hero.thumbnail_url}
              alt=""
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

          {/* Top-left stats */}
          <div className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-widest text-white/85">
            <span className="text-croll">{formatCount(event.upload_count)} clips</span>
            <span className="text-ash"> · </span>
            {formatCount(contributorCount)} contributors
          </div>

          {/* Play */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white/15 p-4 backdrop-blur transition group-hover:bg-white/25">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Bottom-left venue */}
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="font-heading text-xl font-bold leading-tight md:text-2xl">
              {event.venue_name} · {event.city}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-300">
              {ent?.name ?? ''} · {formatShortDate(event.event_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Right — setlist + sections */}
      <div className="rounded-lg border border-white/5 bg-smoke/40 p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
          // INSIDE THE SHOW
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">
          Step through the night, song by song. Filter by where in the venue it was filmed.
        </p>

        {setlist.length > 0 ? (
          <ol className="mt-5 space-y-px">
            {setlist.map((song, i) => {
              const count = setlistCounts.get(song) ?? 0;
              const isActive = song === activeSong;
              return (
                <li
                  key={song + i}
                  className={`flex items-center gap-3 rounded px-2.5 py-1.5 text-sm ${
                    isActive ? 'bg-croll/15 text-white' : 'text-gray-300'
                  }`}
                >
                  <span className="w-6 shrink-0 font-mono text-[10px] tabular-nums text-gray-600">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{song}</span>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      isActive ? 'text-croll' : 'text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-5 rounded border border-white/5 bg-ink/40 p-4 text-xs text-gray-500">
            No setlist captured yet.
          </p>
        )}

        {/* Section pills */}
        <div className="mt-5 flex flex-wrap gap-1.5">
          {sectionsToShow.map((s) => {
            const present = sectionsPresent.has(s);
            return (
              <span
                key={s}
                className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest ${
                  present
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-white/5 bg-white/5 text-gray-600'
                }`}
              >
                {SECTION_LABELS[s]}
              </span>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={ent ? `/${ent.slug}/${event.slug}` : '#'}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-gray-200"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            Open this show
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  // "May 10" — drops the year for compact UI; falls back to formatEventDate if parse fails.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (Number.isNaN(date.getTime())) return formatEventDate(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
