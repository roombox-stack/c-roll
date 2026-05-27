// /watch/[mediaId] — full-screen media viewer.
//
// Server-rendered with the media, event, and entity joined. View count is
// incremented on load (no per-session dedup in V1 — that's a polish item).
// Prev/next navigation is chronological within the same event.

import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { SECTION_LABELS, type SectionTag } from '@/lib/types';
import { VideoPlayer } from '@/components/video-player';
import { LikeButton } from '@/components/like-button';
import { ViewPing } from '@/components/view-ping';
import { Footer } from '@/components/footer';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { formatEventDate, formatCount } from '@/components/format';

export const dynamic = 'force-dynamic';

interface WatchRow {
  id: string;
  file_type: 'photo' | 'video';
  storage_url: string;
  mux_playback_id: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  song_tag: string | null;
  section_tag: SectionTag | null;
  caption: string | null;
  like_count: number;
  view_count: number;
  created_at: string;
  event_id: string;
  event: {
    id: string;
    slug: string;
    name: string;
    venue_name: string;
    city: string;
    event_date: string;
    entity: { slug: string; name: string } | { slug: string; name: string }[] | null;
  } | { id: string; slug: string; name: string; venue_name: string; city: string; event_date: string; entity: unknown }[] | null;
  uploader: { username: string | null; display_name: string | null } | null;
}

async function fetchMedia(mediaId: string): Promise<WatchRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('media')
    .select(
      'id, file_type, storage_url, mux_playback_id, thumbnail_url, duration_sec, song_tag, section_tag, caption, like_count, view_count, created_at, event_id, event:events(id, slug, name, venue_name, city, event_date, entity:entities(slug, name)), uploader:users(username, display_name)',
    )
    .eq('id', mediaId)
    .eq('status', 'active')
    .maybeSingle();
  return (data as unknown as WatchRow) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { mediaId: string };
}): Promise<Metadata> {
  const m = await fetchMedia(params.mediaId);
  if (!m) return { title: 'Not found' };
  const ev = Array.isArray(m.event) ? m.event[0] : m.event;
  const entity = ev ? (Array.isArray(ev.entity) ? ev.entity[0] : ev.entity) : null;
  const title = m.song_tag
    ? `${m.song_tag} — ${entity?.name ?? ''}`
    : `${entity?.name ?? 'c-roll'} — ${ev?.venue_name ?? ''}`;
  const description = m.caption ?? `Fan-shot ${m.file_type} from ${entity?.name ?? 'c-roll'}.`;
  return {
    title,
    description,
    alternates: { canonical: `/watch/${m.id}` },
    openGraph: {
      title,
      description,
      type: m.file_type === 'video' ? 'video.other' : 'website',
      images: m.thumbnail_url ? [{ url: m.thumbnail_url, width: 1280, height: 720 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: m.thumbnail_url ? [m.thumbnail_url] : undefined,
    },
  };
}

export default async function WatchPage({ params }: { params: { mediaId: string } }) {
  const media = await fetchMedia(params.mediaId);
  if (!media) notFound();

  const ev = Array.isArray(media.event) ? media.event[0] : media.event;
  const entity = ev ? (Array.isArray(ev.entity) ? ev.entity[0] : ev.entity) : null;

  const supabase = createAdminClient();

  // View count is bumped client-side via <ViewPing /> → POST /api/view.
  // Deduped per (media, session_token) in the media_views table.

  // Prev / next within the same event, ordered by created_at desc.
  const { data: siblings } = await supabase
    .from('media')
    .select('id')
    .eq('event_id', media.event_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  const ids = (siblings ?? []).map((s) => s.id);
  const idx = ids.indexOf(media.id);
  const prevId = idx > 0 ? ids[idx - 1] : null;
  const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

  const backHref = entity && ev ? `/${entity.slug}/${ev.slug}` : '/';

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <ViewPing mediaId={media.id} />
      <div className="flex flex-1 flex-col md:flex-row">
      {/* Media stage */}
      <div className="relative flex flex-1 items-center justify-center bg-black p-2 md:p-6">
        {media.file_type === 'video' && media.mux_playback_id ? (
          <div className="w-full max-w-5xl">
            <VideoPlayer
              playbackId={media.mux_playback_id}
              autoPlay
              poster={media.thumbnail_url ?? undefined}
            />
          </div>
        ) : media.file_type === 'photo' ? (
          <Image
            src={media.storage_url}
            alt={media.caption ?? media.song_tag ?? ''}
            width={1920}
            height={1280}
            unoptimized
            priority
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="max-h-[85vh] w-auto rounded object-contain"
          />
        ) : (
          <div className="text-sm text-gray-400">
            Video still processing — check back in a minute.
          </div>
        )}

        {/* Prev / next overlay */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-4 md:flex">
          {prevId ? (
            <Link
              href={`/watch/${prevId}`}
              aria-label="Previous"
              className="pointer-events-auto rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
          ) : (
            <span />
          )}
          {nextId ? (
            <Link
              href={`/watch/${nextId}`}
              aria-label="Next"
              className="pointer-events-auto rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>

      {/* Side panel */}
      <aside className="w-full shrink-0 border-t border-ash bg-smoke p-6 md:w-80 md:border-l md:border-t-0">
        <Link href={backHref} className="text-sm text-gray-400 hover:text-white">
          ← Back to show
        </Link>

        {entity && ev ? (
          <div className="mt-3 space-y-1">
            <Link href={`/${entity.slug}`} className="block text-lg font-semibold hover:underline">
              {entity.name}
            </Link>
            <Link
              href={`/${entity.slug}/${ev.slug}`}
              className="block text-sm text-gray-300 hover:underline"
            >
              {ev.venue_name}, {ev.city}
            </Link>
            <p className="text-sm text-gray-500">{formatEventDate(ev.event_date)}</p>
          </div>
        ) : null}

        {media.song_tag ? (
          <div className="mt-4 rounded bg-ink px-3 py-2 text-sm">
            <span className="text-gray-400">Song: </span>
            {media.song_tag}
          </div>
        ) : null}
        {media.section_tag ? (
          <div className="mt-2 rounded bg-ink px-3 py-2 text-sm">
            <span className="text-gray-400">Section: </span>
            {SECTION_LABELS[media.section_tag] ?? media.section_tag}
          </div>
        ) : null}
        {media.caption ? (
          <p className="mt-4 italic text-gray-300">“{media.caption}”</p>
        ) : null}

        <div className="mt-6 flex items-center gap-4">
          <LikeButton mediaId={media.id} initialLikeCount={media.like_count} />
          {media.file_type === 'video' ? (
            <span className="text-sm text-gray-400">
              {formatCount(media.view_count)} views
            </span>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          by{' '}
          {media.uploader?.username || media.uploader?.display_name ? (
            <span>@{media.uploader.username ?? media.uploader.display_name}</span>
          ) : (
            <span>anonymous</span>
          )}
          {' · '}
          {new Date(media.created_at).toLocaleDateString()}
        </p>
      </aside>
      </div>
      <Footer />
    </div>
  );
}
