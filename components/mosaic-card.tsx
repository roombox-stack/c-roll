// Mosaic-style card for the event Browse tab grid.
// Unlike the standard MediaCard (which uses a fixed aspect ratio), this card
// uses aspect-video for videos and aspect-[4/5] for photos so the CSS-columns
// masonry layout produces natural height variation.

import Link from 'next/link';
import { SECTION_LABELS, type SectionTag } from '@/lib/types';
import { formatCount } from './format';
import type { MediaCardData } from './media-card';

/** Returns null for blank or generic "Untitled*" placeholders so they don't render. */
function cleanLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t.startsWith('untitled')) return null;
  return s.trim();
}

function fmtDur(sec: number | null): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MosaicCard({ media }: { media: MediaCardData }) {
  const isVideo = media.file_type === 'video';
  const thumb = media.thumbnail_url ?? (isVideo ? null : media.storage_url);
  const dur = fmtDur(media.duration_sec);

  const sectionLabel =
    media.section_tag && media.section_tag in SECTION_LABELS
      ? SECTION_LABELS[media.section_tag as SectionTag]
      : null;

  const handle = media.uploader_id
    ? `@${media.uploader_id.slice(0, 8)}`
    : media.upload_session
      ? `@${media.upload_session.slice(0, 8)}`
      : '@anon';

  // Photos tend to be portrait, videos landscape — this drives mosaic variation.
  const aspect = isVideo ? 'aspect-video' : 'aspect-[4/5]';

  return (
    <Link
      href={`/watch/${media.id}`}
      className="group block overflow-hidden rounded-lg bg-smoke"
    >
      <div className={`relative ${aspect}`}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={media.song_tag ?? media.caption ?? ''}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-ash">
            <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}

        {/* Bottom gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Top row: section tag left, duration right */}
        <div className="absolute left-0 top-0 flex w-full items-start justify-between gap-1 p-2">
          {sectionLabel ? (
            <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm">
              {sectionLabel}
            </span>
          ) : (
            <span />
          )}
          {dur && (
            <span className="rounded bg-black/65 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/90 backdrop-blur-sm">
              {dur}
            </span>
          )}
        </div>

        {/* Play button (videos only) */}
        {isVideo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white/90 p-2.5 shadow-lg opacity-90 transition duration-200 group-hover:scale-110 group-hover:opacity-100">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="black">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Bottom metadata */}
        <div className="absolute inset-x-0 bottom-0 space-y-0.5 px-2.5 pb-2.5 pt-6">
          {cleanLabel(media.song_tag) && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-croll" />
              <span className="truncate text-[11px] font-semibold text-white">
                {cleanLabel(media.song_tag)}
              </span>
            </div>
          )}
          {cleanLabel(media.caption) && (
            <p className="truncate text-[10px] leading-snug text-gray-300">{cleanLabel(media.caption)}</p>
          )}
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span>{handle}</span>
            {media.like_count > 0 && (
              <span className="flex items-center gap-1 text-gray-400">
                <svg
                  className="h-2.5 w-2.5 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                {formatCount(media.like_count)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
