'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MediaCard, type MediaCardData } from './media-card';
import { formatCount } from './format';

const PAGE_SIZE = 24;

type Filter = 'all' | 'video' | 'photo';

interface Props {
  uploads: MediaCardData[];
  isOwn: boolean;
}

export function ProfileMediaGrid({ uploads, isOwn }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE_SIZE);

  const filtered = uploads.filter((m) => {
    if (filter === 'all') return true;
    return m.file_type === filter;
  });

  const visible = filtered.slice(0, shown);
  const hasMore = shown < filtered.length;

  if (uploads.length === 0) {
    return (
      <div className="rounded-xl border border-ash bg-smoke p-10 text-center">
        <p className="text-gray-400">
          {isOwn
            ? 'No uploads yet — grab your phone at the next show.'
            : 'No uploads yet.'}
        </p>
        <Link
          href="/events"
          className="mt-4 inline-block rounded-md border border-ash bg-smoke px-4 py-2 text-sm hover:bg-ash"
        >
          Browse events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'video', 'photo'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setShown(PAGE_SIZE);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f
                ? 'bg-white text-black'
                : 'border border-ash bg-smoke text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? `All (${formatCount(uploads.length)})` : f === 'video' ? `Videos (${formatCount(uploads.filter((m) => m.file_type === 'video').length)})` : `Photos (${formatCount(uploads.filter((m) => m.file_type === 'photo').length)})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No {filter}s yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((m) => (
              <MediaCard key={m.id} media={m} showEventLabel />
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setShown((s) => s + PAGE_SIZE)}
                className="rounded-md border border-ash bg-smoke px-6 py-2 text-sm hover:bg-ash"
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
