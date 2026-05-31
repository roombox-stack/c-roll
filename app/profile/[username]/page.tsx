// /profile/[username] — public contributor identity page.
//
// Sections:
//   1. Header — avatar, display name, @username, bio, join date,
//      edit/sign-out (own) or follow button (visitor).
//   2. Stats bar — shows filmed, total views, total likes, photos, videos, uploads.
//   3. Badges strip — earned milestones, dimmed unearned ones.
//   4. Featured clip — most-viewed video hero card.
//   5. Upload portfolio grid (client, with filter pills + load-more).
//   6. Show timeline — attended shows grouped by year with per-show upload counts.

import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { MediaCard, type MediaCardData } from '@/components/media-card';
import { SignOutButton } from '@/components/sign-out-button';
import { ProfileFollowButton } from '@/components/profile-follow-button';
import { FollowListModal } from '@/components/follow-list-modal';
import { ProfileMediaGrid } from '@/components/profile-media-grid';
import { formatCount, formatEventDate } from '@/components/format';

export const dynamic = 'force-dynamic';

// Early-contributor cutoff: 6 months from today (2026-11-30).
const EARLY_CONTRIBUTOR_CUTOFF = '2026-11-30';

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  upload_count: number;
  show_count: number;
  follower_count: number;
  following_count: number;
  created_at: string;
}

async function fetchProfile(username: string): Promise<ProfileRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select(
      'id, username, display_name, avatar_url, bio, upload_count, show_count, follower_count, following_count, created_at',
    )
    .eq('username', username)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await fetchProfile(params.username);
  if (!profile) return { title: 'Profile not found' };
  const name = profile.display_name ?? profile.username;
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio ?? `${name}'s shows and uploads on c-roll.`,
    alternates: { canonical: `/profile/${profile.username}` },
  };
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const profile = await fetchProfile(params.username);
  if (!profile) notFound();

  const currentUser = await getCurrentUser();
  const isOwn = currentUser?.id === profile.id;

  const supabase = createAdminClient();

  const [attendedRes, uploadsRes, followRes] = await Promise.all([
    supabase
      .from('attended_events')
      .select(
        'attended_at, event:events(id, slug, name, venue_name, city, state, event_date, upload_count, entity:entities(id, slug, name))',
      )
      .eq('user_id', profile.id)
      .order('attended_at', { ascending: false })
      .limit(200),

    supabase
      .from('media')
      .select(
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, caption, view_count, like_count, is_full_song, event:events(id, name, city, slug, entity:entities(slug))',
      )
      .eq('uploader_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200),

    // Is current user following this profile?
    currentUser && !isOwn
      ? supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const attendedRaw = (attendedRes.data ?? []) as unknown as Array<{
    attended_at: string;
    event: {
      id: string;
      slug: string;
      name: string;
      venue_name: string;
      city: string;
      state: string | null;
      event_date: string;
      upload_count: number;
      entity: { id: string; slug: string; name: string } | { id: string; slug: string; name: string }[] | null;
    } | null;
  }>;

  const attended = attendedRaw
    .map((a) => a.event)
    .filter((e): e is NonNullable<typeof e> => e != null);

  type UploadRow = MediaCardData & {
    event: { id: string; name: string; city?: string; slug: string; entity: { slug: string } | { slug: string }[] | null } | null;
  };
  const uploads = (uploadsRes.data ?? []) as unknown as UploadRow[];

  const isFollowing = followRes.data != null;

  // ── Computed stats ──────────────────────────────────────────────────────────
  const totalViews = uploads.reduce((s, m) => s + (m.view_count ?? 0), 0);
  const totalLikes = uploads.reduce((s, m) => s + (m.like_count ?? 0), 0);
  const photoCount = uploads.filter((m) => m.file_type === 'photo').length;
  const videoCount = uploads.filter((m) => m.file_type === 'video').length;

  // Shows filmed = distinct events where this user has an upload.
  const uploadEventIds = new Set(
    uploads.map((m) => (m.event as unknown as { id?: string } | null)?.id).filter((id): id is string => typeof id === 'string'),
  );
  const showsFilmed = uploadEventIds.size;

  // ── Featured clip — most-viewed active video ────────────────────────────────
  type UploadRowWithPlayback = UploadRow & { mux_playback_id?: string | null };
  const featuredClip = (uploads as UploadRowWithPlayback[])
    .filter((m) => m.file_type === 'video' && m.mux_playback_id)
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))[0] ?? null;

  // ── Badges ──────────────────────────────────────────────────────────────────
  const distinctCities = new Set(
    uploads
      .map((m) => m.event?.city)
      .filter((c): c is string => typeof c === 'string' && c.length > 0),
  );

  const badges = computeBadges({
    uploadCount: uploads.length,
    showsFilmed,
    totalViews,
    distinctCities: distinctCities.size,
    joinedAt: profile.created_at,
  });

  // ── Show timeline — group attended shows by year ────────────────────────────
  type AttendedShow = {
    id: string;
    slug: string;
    name: string;
    venue_name: string;
    city: string;
    state: string | null;
    event_date: string;
    upload_count: number;
    entity: { id: string; slug: string; name: string } | null;
    userUploadCount: number;
  };

  // Build per-event upload count map for this user.
  const perEventUploads = new Map<string, number>();
  for (const m of uploads) {
    const eid = m.event?.['id' as never] as string | undefined;
    if (eid) perEventUploads.set(eid, (perEventUploads.get(eid) ?? 0) + 1);
  }

  const shows: AttendedShow[] = attended.map((ev) => {
    const ent = Array.isArray(ev.entity) ? ev.entity[0] : ev.entity;
    return {
      ...ev,
      entity: ent ?? null,
      userUploadCount: perEventUploads.get(ev.id) ?? 0,
    };
  });

  // Group by year, descending.
  const showsByYear = new Map<number, AttendedShow[]>();
  for (const show of shows) {
    const year = new Date(show.event_date + 'T00:00:00').getFullYear();
    if (!showsByYear.has(year)) showsByYear.set(year, []);
    showsByYear.get(year)!.push(show);
  }
  const sortedYears = Array.from(showsByYear.keys()).sort((a, b) => b - a);

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const displayName = profile.display_name ?? profile.username;
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Cast uploads to MediaCardData[] for the grid component.
  const gridUploads = uploads as unknown as MediaCardData[];

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-ash bg-smoke text-3xl font-semibold text-gray-300">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span>{initials || '?'}</span>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{displayName}</h1>
              {!isOwn ? (
                <ProfileFollowButton
                  username={profile.username}
                  initialFollowing={isFollowing}
                  initialFollowerCount={profile.follower_count ?? 0}
                  isAuthed={currentUser != null}
                />
              ) : null}
            </div>
            <p className="text-sm text-gray-400">@{profile.username}</p>
            {profile.bio ? (
              <p className="max-w-2xl text-gray-300">{profile.bio}</p>
            ) : null}
            <p className="text-xs text-gray-500">Joined {joinDate}</p>

            {/* Follower / Following counts — open modal on click */}
            <FollowListModal
              username={profile.username}
              followerCount={profile.follower_count ?? 0}
              followingCount={profile.following_count ?? 0}
              isAuthed={currentUser != null}
            />
          </div>

          {isOwn ? (
            <div className="flex shrink-0 gap-2">
              <Link
                href="/profile/me/edit"
                className="rounded-md border border-ash bg-smoke px-3 py-1.5 text-sm hover:bg-ash"
              >
                Edit profile
              </Link>
              <SignOutButton />
            </div>
          ) : null}
        </header>

        {/* ── Stats bar ──────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Stat value={showsFilmed} label="Shows Filmed" />
          <Stat value={totalViews} label="Total Views" />
          <Stat value={totalLikes} label="Total Likes" />
          <Stat value={photoCount} label="Photos" />
          <Stat value={videoCount} label="Videos" />
          <Stat value={uploads.length} label="Uploads" />
        </section>

        {/* ── Badges ─────────────────────────────────────────────────────────── */}
        {badges.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">Milestones</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {badges.map((b) => (
                <BadgeChip key={b.id} badge={b} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Featured clip ──────────────────────────────────────────────────── */}
        {featuredClip ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">Featured Clip</h2>
            <div className="max-w-sm">
              <MediaCard media={featuredClip as unknown as MediaCardData} showEventLabel size="lg" />
            </div>
          </section>
        ) : null}

        {/* ── Upload portfolio ───────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Uploads</h2>
          <ProfileMediaGrid uploads={gridUploads} isOwn={isOwn} />
        </section>

        {/* ── Show timeline ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xl font-semibold">Show Timeline</h2>
          {shows.length === 0 ? (
            <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
              {isOwn
                ? "You haven't marked any shows yet. Open an event page and tap \"I was there\"."
                : 'No shows yet.'}
            </p>
          ) : (
            <div className="space-y-8">
              {sortedYears.map((year) => (
                <div key={year}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-lg font-semibold text-gray-200">{year}</span>
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-gray-500">
                      {showsByYear.get(year)!.length} show
                      {showsByYear.get(year)!.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {showsByYear.get(year)!.map((show) => (
                      <ShowTimelineCard key={show.id} show={show} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-ash bg-smoke p-3 text-center sm:p-4">
      <div className="text-xl font-semibold tabular-nums sm:text-2xl">{formatCount(value)}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">
        {label}
      </div>
    </div>
  );
}

interface BadgeSpec {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
  description: string;
}

function computeBadges({
  uploadCount,
  showsFilmed,
  totalViews,
  distinctCities,
  joinedAt,
}: {
  uploadCount: number;
  showsFilmed: number;
  totalViews: number;
  distinctCities: number;
  joinedAt: string;
}): BadgeSpec[] {
  const cutoff = new Date(EARLY_CONTRIBUTOR_CUTOFF);
  return [
    {
      id: 'first-upload',
      label: 'First Upload',
      icon: '🎬',
      earned: uploadCount >= 1,
      description: 'Uploaded their first clip',
    },
    {
      id: 'shows-5',
      label: '5 Shows Filmed',
      icon: '🎤',
      earned: showsFilmed >= 5,
      description: 'Filmed at 5 shows',
    },
    {
      id: 'shows-10',
      label: '10 Shows Filmed',
      icon: '🎸',
      earned: showsFilmed >= 10,
      description: 'Filmed at 10 shows',
    },
    {
      id: 'shows-25',
      label: '25 Shows Filmed',
      icon: '🏟️',
      earned: showsFilmed >= 25,
      description: 'Filmed at 25 shows',
    },
    {
      id: 'views-1k',
      label: '1K Views',
      icon: '👁️',
      earned: totalViews >= 1_000,
      description: 'Clips viewed 1,000+ times',
    },
    {
      id: 'views-10k',
      label: '10K Views',
      icon: '🔥',
      earned: totalViews >= 10_000,
      description: 'Clips viewed 10,000+ times',
    },
    {
      id: 'views-100k',
      label: '100K Views',
      icon: '⚡',
      earned: totalViews >= 100_000,
      description: 'Clips viewed 100,000+ times',
    },
    {
      id: 'multi-city',
      label: 'Multi-City',
      icon: '✈️',
      earned: distinctCities >= 3,
      description: 'Uploaded from shows in 3+ cities',
    },
    {
      id: 'early-contributor',
      label: 'Early Contributor',
      icon: '⭐',
      earned: new Date(joinedAt) < cutoff,
      description: 'Joined during the early days',
    },
  ];
}

function BadgeChip({ badge }: { badge: BadgeSpec }) {
  return (
    <div
      title={badge.description}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-4 py-3 transition ${
        badge.earned
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          : 'border-white/10 bg-white/5 text-gray-600'
      }`}
    >
      <span className={`text-2xl ${badge.earned ? '' : 'grayscale'}`} aria-hidden>
        {badge.icon}
      </span>
      {!badge.earned ? (
        <span className="text-gray-600" aria-hidden>
          🔒
        </span>
      ) : null}
      <span className="whitespace-nowrap text-xs font-medium">{badge.label}</span>
    </div>
  );
}

interface ShowData {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  entity: { id: string; slug: string; name: string } | null;
  userUploadCount: number;
}

function ShowTimelineCard({ show }: { show: ShowData }) {
  const location = [show.city, show.state].filter(Boolean).join(', ');
  const href = show.entity
    ? `/${show.entity.slug}/${show.slug}`
    : `/events/${show.id}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border border-ash bg-smoke px-4 py-3 transition hover:border-white/20 hover:bg-white/5"
    >
      <div className="min-w-0 flex-1">
        {show.entity ? (
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {show.entity.name}
          </div>
        ) : null}
        <div className="truncate font-medium">{show.venue_name}</div>
        <div className="text-sm text-gray-400">{location}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm text-gray-300">{formatEventDate(show.event_date)}</div>
        {show.userUploadCount > 0 ? (
          <div className="text-xs text-gray-500">
            {show.userUploadCount} upload{show.userUploadCount === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
