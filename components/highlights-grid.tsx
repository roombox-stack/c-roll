// Client-side show-more for the entity page Fan highlights section.
//
// All items are already sorted and passed as props from the server component
// (capped at 200 server-side). We reveal 24 at a time using an
// IntersectionObserver so the user doesn't see a jarring button click.

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { CardLikeButton } from './card-like-button';
import { formatCount, formatDuration } from './format';
import { FullSongBadge } from './media-card';
import type { SectionTag } from '@/lib/types';

const PAGE = 24;

function cleanLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t.startsWith('untitled')) return null;
  return s.trim();
}

export interface HighlightItem {
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
  is_full_song: boolean;
  event_id?: string | null;
}

export function HighlightsGrid({ items, onItemClick }: { items: HighlightItem[]; onItemClick?: (id: string) => void }) {
  const [visible, setVisible] = useState(Math.min(PAGE, items.length));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const exhausted = visible >= items.length;

  useEffect(() => {
    setVisible(Math.min(PAGE, items.length));
  }, [items]);

  useEffect(() => {
    if (exhausted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => Math.min(v + PAGE, items.length));
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [exhausted, items.length]);

  const shown = items.slice(0, visible);
  const hero = shown[0];
  const rest = shown.slice(1);

  if (!hero) {
    return (
      <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
        No highlights match this filter yet.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_1fr_1fr] md:grid-rows-2">
        <div className="md:col-span-1 md:row-span-2">
          <HeroCard media={hero} onItemClick={onItemClick} />
        </div>
        {rest.slice(0, 4).map((m) => (
          <SmallCard key={m.id} media={m} onItemClick={onItemClick} />
        ))}
      </div>

      {rest.length > 4 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {rest.slice(4).map((m) => (
            <SmallCard key={m.id} media={m} onItemClick={onItemClick} />
          ))}
        </div>
      ) : null}

      {!exhausted && (
        <div ref={sentinelRef} className="mt-4 flex justify-center py-4">
          <span className="text-sm text-gray-500">Loading…</span>
        </div>
      )}
    </>
  );
}

function HeroCard({ media, onItemClick }: { media: HighlightItem; onItemClick?: (id: string) => void }) {
  const thumb =
    media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const isVideo = media.file_type === 'video';
  const inner = (
    <div className="relative h-full min-h-[280px] md:min-h-[420px]">
      {thumb ? (
        <Image src={thumb} alt="" fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" placeholder="blur" blurDataURL={BLUR_DATA_URL} unoptimized />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-950 to-ink" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
      <span className="absolute left-3 top-3 rounded-md bg-purple-600/90 px-2 py-1 text-xs font-semibold text-white">
        {formatCount(media.view_count)} views
      </span>
      {isVideo && media.is_full_song ? <FullSongBadge className="absolute right-3 top-3" /> : null}
      {isVideo ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/85 p-4 opacity-90 transition group-hover:scale-110">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="black" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      ) : null}
      {isVideo && media.duration_sec ? (
        <span className="absolute bottom-3 right-3 rounded bg-black/70 px-1.5 py-0.5 text-xs tabular-nums">
          {formatDuration(media.duration_sec)}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
        {(cleanLabel(media.song_tag) ?? cleanLabel(media.caption)) ? (
          <div className="text-base font-semibold">{cleanLabel(media.song_tag) ?? cleanLabel(media.caption)}</div>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="group relative h-full overflow-hidden rounded-lg bg-smoke">
      {onItemClick ? (
        <button type="button" onClick={() => onItemClick(media.id)} className="block h-full w-full text-left">
          {inner}
        </button>
      ) : (
        <Link href={`/watch/${media.id}`} className="block h-full">{inner}</Link>
      )}
      <CardLikeButton
        mediaId={media.id}
        initialLikeCount={media.like_count}
        className="absolute right-3 top-3 z-10"
      />
    </div>
  );
}

function SmallCard({ media, onItemClick }: { media: HighlightItem; onItemClick?: (id: string) => void }) {
  const thumb =
    media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const isVideo = media.file_type === 'video';
  const inner = (
    <div className="relative aspect-[3/4]">
      {thumb ? (
        <Image src={thumb} alt="" fill sizes="240px" className="object-cover" placeholder="blur" blurDataURL={BLUR_DATA_URL} unoptimized />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      {isVideo && media.is_full_song ? <FullSongBadge className="absolute left-2 top-2" /> : null}
      {isVideo ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/80 p-2.5 opacity-90 transition group-hover:scale-110">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="black" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      ) : null}
      {isVideo && media.duration_sec ? (
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums">
          {formatDuration(media.duration_sec)}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-2.5 text-xs">
        {(cleanLabel(media.song_tag) ?? cleanLabel(media.caption)) ? (
          <div className="truncate text-sm font-medium">{cleanLabel(media.song_tag) ?? cleanLabel(media.caption)}</div>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="group relative overflow-hidden rounded-lg bg-smoke">
      {onItemClick ? (
        <button type="button" onClick={() => onItemClick(media.id)} className="block w-full text-left">
          {inner}
        </button>
      ) : (
        <Link href={`/watch/${media.id}`} className="block">{inner}</Link>
      )}
      <CardLikeButton
        mediaId={media.id}
        initialLikeCount={media.like_count}
        className="absolute right-2 top-2 z-10"
      />
    </div>
  );
}
