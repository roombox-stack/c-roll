// /profile/[username] — public profile page.
//
// Sections:
//   1. Header — avatar (initials fallback), display name, @username, bio,
//      join date, sign-out + edit (own profile only).
//   2. Stats row — shows / artists / uploads / likes received.
//   3. Shows attended — event cards, most recent first, max 12 then "View all".
//   4. Uploads — media grid (their uploaded items).

import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { MediaCard, type MediaCardData } from '@/components/media-card';
import { EventCard } from '@/components/event-card';
import { SignOutButton } from '@/components/sign-out-button';
import { formatCount, formatEventDate } from '@/components/format';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  upload_count: number;
  show_count: number;
  created_at: string;
}

async function fetchProfile(username: string): Promise<ProfileRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, bio, upload_count, show_count, created_at')
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

  const [attendedRes, uploadsRes, likesRes] = await Promise.all([
    // Shows attended — newest first; we'll slice to 12 below.
    supabase
      .from('attended_events')
      .select(
        'attended_at, event:events(id, slug, name, venue_name, city, state, event_date, upload_count, entity:entities(slug, name))',
      )
      .eq('user_id', profile.id)
      .order('attended_at', { ascending: false })
      .limit(50),

    // Uploads — their active media, newest first.
    supabase
      .from('media')
      .select(
        'id, file_type, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, caption, view_count, like_count, is_full_song, event:events(name, city)',
      )
      .eq('uploader_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(24),

    // Likes received — sum of like_count across all their media. We pull just
    // like_count to keep the result tiny.
    supabase
      .from('media')
      .select('like_count')
      .eq('uploader_id', profile.id)
      .eq('status', 'active'),
  ]);

  const attendedRaw = (attendedRes.data ?? []) as unknown as Array<{
    attended_at: string;
    event:
      | {
          id: string;
          slug: string;
          name: string;
          venue_name: string;
          city: string;
          state: string | null;
          event_date: string;
          upload_count: number;
          entity: { slug: string; name: string } | { slug: string; name: string }[] | null;
        }
      | null;
  }>;
  const attended = attendedRaw
    .map((a) => a.event)
    .filter((e): e is NonNullable<typeof e> => e != null);

  // Distinct artist count via entity_id from attended events.
  const distinctArtists = new Set<string>();
  for (const ev of attended) {
    const ent = Array.isArray(ev.entity) ? ev.entity[0] : ev.entity;
    if (ent) distinctArtists.add(ent.slug);
  }

  const uploads = (uploadsRes.data ?? []) as unknown as MediaCardData[];
  const likesReceived = (likesRes.data ?? []).reduce(
    (sum, m) => sum + ((m as { like_count?: number }).like_count ?? 0),
    0,
  );

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

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        {/* Header */}
        <header className="flex flex-col items-start gap-6 sm:flex-row">
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
          <div className="flex-1 space-y-1">
            <h1 className="text-3xl font-bold">{displayName}</h1>
            <p className="text-sm text-gray-400">@{profile.username}</p>
            {profile.bio ? (
              <p className="max-w-2xl pt-2 text-gray-300">{profile.bio}</p>
            ) : null}
            <p className="pt-2 text-xs text-gray-500">Joined {joinDate}</p>
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

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={attended.length} label="Shows" />
          <Stat value={distinctArtists.size} label="Artists" />
          <Stat value={uploads.length} label="Uploads" />
          <Stat value={likesReceived} label="Likes received" />
        </section>

        {/* Shows attended */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Shows attended</h2>
            {attended.length > 12 ? (
              <span className="text-sm text-gray-400">View all →</span>
            ) : null}
          </div>
          {attended.length === 0 ? (
            <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
              {isOwn
                ? 'You haven’t marked any shows yet. Open an event page and tap “I was there”.'
                : 'No shows marked yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {attended.slice(0, 12).map((ev) => {
                const ent = Array.isArray(ev.entity) ? ev.entity[0] : ev.entity;
                if (!ent) return null;
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
                      state: ev.state,
                      event_date: ev.event_date,
                      upload_count: ev.upload_count,
                      entity: ent,
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Uploads */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Uploads</h2>
            {uploads.length > 0 ? (
              <span className="text-sm text-gray-400">
                {formatCount(uploads.length)}
                {uploads.length === 24 ? '+' : ''}
              </span>
            ) : null}
          </div>
          {uploads.length === 0 ? (
            <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
              {isOwn
                ? 'No uploads yet. Upload from any event page to see them here.'
                : 'No uploads yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {uploads.map((m) => (
                <MediaCard key={m.id} media={m} showEventLabel />
              ))}
            </div>
          )}
        </section>

        {/* Small dev-affordance: hint about join date noise */}
        <p className="text-center text-xs text-gray-600">
          {formatEventDate(profile.created_at)}
        </p>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-ash bg-smoke p-4 text-center">
      <div className="text-2xl font-semibold tabular-nums">{formatCount(value)}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-gray-500">{label}</div>
    </div>
  );
}
