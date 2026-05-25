'use client';

// Debounced search-as-you-type view. Calls /api/search 300ms after the last
// keystroke; aborts in-flight requests when the query changes.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types';
import { formatCount, formatEventDate } from '@/components/format';

type EntityHit = {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  follower_count: number;
};
type EventHit = {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  event_date: string;
  upload_count: number;
  entity: { slug: string; name: string } | { slug: string; name: string }[];
};
type SearchResults = { entities: EntityHit[]; events: EventHit[] };

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ac.signal,
        });
        if (!resp.ok) return;
        const data: SearchResults = await resp.json();
        if (!ac.signal.aborted) {
          setResults(data);
          setLoading(false);
        }
      } catch {
        // aborted or network error
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = !!results && (results.entities.length > 0 || results.events.length > 0);
  const showEmpty = !!query.trim() && !loading && results !== null && !hasResults;

  return (
    <div className="space-y-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search artists, teams, shows…"
        autoFocus
        className="w-full rounded-full border border-ash bg-smoke px-5 py-3 text-base placeholder:text-gray-500 focus:border-gray-500 focus:outline-none"
      />

      {!query.trim() ? (
        <p className="text-sm text-gray-400">Type to search.</p>
      ) : showEmpty ? (
        <div className="rounded-lg border border-ash bg-smoke p-6 text-sm">
          <p className="text-gray-300">
            No matches for &ldquo;{query}&rdquo;.
          </p>
          <p className="mt-2 text-gray-500">
            Try a different query, or{' '}
            <Link href="/" className="text-white underline">
              browse trending
            </Link>
            .
          </p>
        </div>
      ) : results ? (
        <>
          {results.entities.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Artists, teams &amp; events
              </h2>
              <ul className="overflow-hidden rounded-lg border border-ash">
                {results.entities.map((ent) => (
                  <li key={ent.id} className="border-b border-ash last:border-b-0">
                    <Link
                      href={`/${ent.slug}`}
                      className="flex items-center justify-between bg-smoke px-4 py-3 hover:bg-ash"
                    >
                      <span>
                        <span className="font-medium">{ent.name}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {ENTITY_TYPE_LABELS[ent.type]}
                        </span>
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatCount(ent.follower_count)} followers
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.events.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Shows
              </h2>
              <ul className="overflow-hidden rounded-lg border border-ash">
                {results.events.map((ev) => {
                  const ent = Array.isArray(ev.entity) ? ev.entity[0] : ev.entity;
                  return (
                    <li key={ev.id} className="border-b border-ash last:border-b-0">
                      <Link
                        href={`/${ent.slug}/${ev.slug}`}
                        className="block bg-smoke px-4 py-3 hover:bg-ash"
                      >
                        <div className="font-medium">{ev.name}</div>
                        <div className="text-xs text-gray-400">
                          {ent.name} · {ev.venue_name}, {ev.city} ·{' '}
                          {formatEventDate(ev.event_date)} · {formatCount(ev.upload_count)} uploads
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
