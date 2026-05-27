// Thumbnail card for a single media item. Links to /watch/[id].
//
// Designed to feel like a YouTube Shorts tile — thumbnail dominates, labels
// overlay on a darkened gradient.

import Link from 'next/link';

function cleanLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t.startsWith('untitled')) return null;
  return s.trim();
}
import Image from 'next/image';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { CardLikeButton } from './card-like-button';
import { formatCount, formatDuration } from './format';

export type MediaCardData = {
  id: string;
  file_type: 'photo' | 'video';
  storage_url: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  caption: string | null;
  song_tag: string | null;
  section_tag?: string | null;
  uploader_id?: string | null;
  upload_session?: string | null;
  view_count: number;
  like_count: number;
  is_full_song?: boolean;
  event?: { name: string; city?: string; venue_name?: string } | null;
};

/**
 * Small "Full Song" pill — shown on video tiles where is_full_song = true.
 * Heroicons outline `musical-note` glyph, subtle dark pill.
 */
export function FullSongBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur ${className}`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
      </svg>
      Full Song
    </span>
  );
}

export function MediaCard({
  media,
  size = 'md',
  showEventLabel = false,
}: {
  media: MediaCardData;
  size?: 'sm' | 'md' | 'lg';
  showEventLabel?: boolean;
}) {
  const isVideo = media.file_type === 'video';
  const thumb = media.thumbnail_url ?? (isVideo ? null : media.storage_url);
  const aspect = size === 'lg' ? 'aspect-[3/4]' : 'aspect-video';

  return (
    // Outer div carries `group` so hover effects (play button scale, like button
    // fade-in) work across the whole card. The <Link> and <CardLikeButton> are
    // siblings — NOT nested — so the like button click won't trigger navigation.
    <div className="group relative overflow-hidden rounded-lg bg-smoke transition-transform hover:scale-[1.02]">
      <Link href={`/watch/${media.id}`} className="block">
        <div className={`relative ${aspect}`}>
          {thumb ? (
            <Image
              src={thumb}
              alt={media.caption ?? media.song_tag ?? ''}
              fill
              sizes={size === 'lg' ? '(min-width:768px) 33vw, 50vw' : '(min-width:768px) 25vw, 50vw'}
              className="object-cover"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-ash text-xs text-gray-500">
              processing…
            </div>
          )}

          {/* gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0" />

          {isVideo && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-white/85 p-2.5 opacity-90 transition group-hover:scale-110 group-hover:opacity-100">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          {isVideo && media.is_full_song ? (
            <FullSongBadge className="absolute left-2 top-2" />
          ) : null}

          {isVideo && media.duration_sec ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums">
              {formatDuration(media.duration_sec)}
            </span>
          ) : null}

          {/* bottom text labels */}
          <div className="absolute inset-x-0 bottom-0 p-2.5 text-xs text-white">
            {(cleanLabel(media.song_tag) || cleanLabel(media.caption)) && (
              <div className="truncate text-sm font-medium">{cleanLabel(media.song_tag) ?? cleanLabel(media.caption)}</div>
            )}
            {showEventLabel && media.event && (
              <div className="truncate text-[11px] text-gray-300">
                {media.event.name}
                {media.event.city ? ` · ${media.event.city}` : ''}
              </div>
            )}
            {isVideo && (
              <div className="mt-1 text-[11px] text-gray-300">
                {formatCount(media.view_count)} views
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Like button — sibling of the Link so it doesn't trigger navigation */}
      <CardLikeButton
        mediaId={media.id}
        initialLikeCount={media.like_count}
        className="absolute right-2 top-2 z-10"
      />
    </div>
  );
}
