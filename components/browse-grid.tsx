// Infinite-scroll masonry grid for the event page Browse tab.
//
// The server component renders the first page; this client component appends
// subsequent pages as the user scrolls to the bottom sentinel.
// Filter/section changes come through URL params → full SSR re-render.

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { MosaicCard } from './mosaic-card';
import type { MediaCardData } from './media-card';

interface BrowseGridProps {
  initialItems: MediaCardData[];
  initialCursor: string | null;
  eventSlug: string;
  filter?: string;
  section?: string;
}

export function BrowseGrid({
  initialItems,
  initialCursor,
  eventSlug,
  filter,
  section,
}: BrowseGridProps) {
  const [items, setItems] = useState<MediaCardData[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const exhausted = cursor === null;

  // Reset when server re-renders with new props (filter/section changed).
  const initKey = initialItems.map((i) => i.id).join(',');
  const prevInitKey = useRef(initKey);
  if (prevInitKey.current !== initKey) {
    prevInitKey.current = initKey;
    setItems(initialItems);
    setCursor(initialCursor);
  }

  function loadMore() {
    if (!cursor || isPending) return;
    startTransition(async () => {
      try {
        const sp = new URLSearchParams({ cursor });
        if (filter) sp.set('filter', filter);
        if (section) sp.set('section', section);
        const res = await fetch(`/api/events/${eventSlug}/media?${sp.toString()}`);
        if (!res.ok) return;
        const json: { items: MediaCardData[]; nextCursor: string | null } = await res.json();
        setItems((prev) => [...prev, ...json.items]);
        setCursor(json.nextCursor);
      } catch {
        // network error — leave state unchanged
      }
    });
  }

  useEffect(() => {
    if (exhausted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, exhausted]);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-ash bg-smoke p-8 text-center text-sm text-gray-400">
        No media matching these filters.
      </p>
    );
  }

  return (
    <>
      {/* Masonry via CSS columns — videos are 16:9, photos 4:5, so heights vary naturally */}
      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
        {items.map((m) => (
          <div key={m.id} className="mb-2 break-inside-avoid">
            <MosaicCard media={m} />
          </div>
        ))}
      </div>

      {!exhausted && (
        <div ref={sentinelRef} className="mt-8 flex justify-center py-4">
          {isPending ? (
            <span className="text-sm text-gray-500">Loading…</span>
          ) : (
            <button
              type="button"
              onClick={loadMore}
              className="rounded-full border border-ash px-5 py-2 text-sm text-gray-300 hover:bg-ash hover:text-white"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </>
  );
}
