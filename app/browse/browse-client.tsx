'use client';

// Client-side filter / sort / view-toggle for /browse.
//
// All datasets are pre-fetched on the server; this component handles the
// interaction state (type filter, sort key, entities-vs-shows toggle) and
// renders the grid or list accordingly. No additional fetches.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { formatCount, formatEventDate } from '@/components/format';
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types';

export interface BrowseEntity {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  hero_image_url: string | null;
  follower_count: number;
  show_count: number;
  upload_count: number;
  last_event_date: string | null;
}

export interface BrowseEvent {
  id: string;
  slug: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  upload_count: number;
  contributor_count: number;
  entity: { slug: string; name: string } | null;
}

type TypeFilter = 'all' | 'artist' | 'team' | 'event_brand';
type SortKey = 'clips' | 'followers' | 'recent' | 'az';
type ViewMode = 'entities' | 'shows';

const TYPE_PILLS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'artist', label: 'Music' },
  { value: 'team', label: 'Sports' },
  { value: 'event_brand', label: 'Events' },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'clips', label: 'Most clips' },
  { value: 'followers', label: 'Most followed' },
  { value: 'recent', label: 'Most recent show' },
  { value: 'az', label: 'A–Z' },
];

export function BrowseClient({
  entities,
  events,
}: {
  entities: BrowseEntity[];
  events: BrowseEvent[];
}) {
  const [view, setView] = useState<ViewMode>('entities');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('clips');

  // ── Entity filter + sort ────────────────────────────────────────────────
  const filteredEntities = useMemo(() => {
    let list =
      typeFilter === 'all' ? entities.slice() : entities.filter((e) => e.type === typeFilter);
    switch (sortKey) {
      case 'clips':
        list.sort((a, b) => b.upload_count - a.upload_count);
        break;
      case 'followers':
        list.sort((a, b) => b.follower_count - a.follower_count);
        break;
      case 'recent':
        list.sort((a, b) => (b.last_event_date ?? '').localeCompare(a.last_event_date ?? ''));
        break;
      case 'az':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [entities, typeFilter, sortKey]);

  // ── Event grouping (Shows view) — month buckets, most recent first ──────
  const groupedEvents = useMemo(() => {
    // Filter by type via the joined entity, when applicable.
    const allowedEntityIds = new Set(filteredEntities.map((e) => e.slug));
    const list =
      typeFilter === 'all'
        ? events
        : events.filter((ev) => ev.entity && allowedEntityIds.has(ev.entity.slug));

    // Already sorted desc by event_date from the server.
    const map = new Map<string, BrowseEvent[]>();
    for (const ev of list) {
      const d = new Date(ev.event_date + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = map.get(key) ?? [];
      bucket.push(ev);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([key, evs]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      return { key, label, events: evs };
    });
  }, [events, filteredEntities, typeFilter]);

  return (
    <>
      {/* ── Sticky filter / sort bar ─────────────────────────────────────── */}
      <div className="sticky top-14 z-30 border-b border-white/5 bg-[#0d0d0d]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          {/* Type pills */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 md:overflow-visible">
            {TYPE_PILLS.map((pill) => {
              const active = typeFilter === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTypeFilter(pill.value)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'border-croll bg-croll text-ink'
                      : 'border-white/10 bg-transparent text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Sort + view toggle */}
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none transition hover:border-white/20 focus:border-white/30"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-ink text-white">
                  {o.label}
                </option>
              ))}
            </select>

            <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
              {(['entities', 'shows'] as ViewMode[]).map((v) => {
                const active = view === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                      active ? 'bg-white text-ink' : 'bg-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    {v === 'entities' ? 'Entities' : 'Shows'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-10">
        {view === 'entities' ? (
          filteredEntities.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
            >
              {filteredEntities.map((e) => (
                <EntityGridCard key={e.id} entity={e} />
              ))}
            </div>
          )
        ) : groupedEvents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            {groupedEvents.map((g) => (
              <ShowsMonthGroup key={g.key} label={g.label} events={g.events} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

// ── Entity card ─────────────────────────────────────────────────────────────

function EntityGridCard({ entity }: { entity: BrowseEntity }) {
  const typeLabel = ENTITY_TYPE_LABELS[entity.type] ?? entity.type;
  return (
    <Link
      href={`/${entity.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-[#141414] transition hover:border-white/[0.14]"
    >
      <div className="relative aspect-video overflow-hidden bg-smoke">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-croll">
          {typeLabel}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{entity.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-gray-500">
            {formatCount(entity.show_count)} {entity.show_count === 1 ? 'show' : 'shows'} ·{' '}
            {formatCount(entity.upload_count)} clips
          </p>
        </div>
        <span
          // Render the Follow control but don't wire it up in V1.
          // Stopping propagation keeps clicks from triggering the card link.
          onClick={(e) => e.preventDefault()}
          className="shrink-0 cursor-default rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-gray-400 transition hover:border-white/30 hover:text-white"
        >
          Follow
        </span>
      </div>
    </Link>
  );
}

// ── Shows view ─────────────────────────────────────────────────────────────

function ShowsMonthGroup({ label, events }: { label: string; events: BrowseEvent[] }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-white/30">
        {label}
      </h2>
      <ul className="divide-y divide-white/5 border-y border-white/5">
        {events.map((ev) => (
          <ShowsRow key={ev.id} event={ev} />
        ))}
      </ul>
    </section>
  );
}

function ShowsRow({ event }: { event: BrowseEvent }) {
  const ent = event.entity;
  const eventHref = ent ? `/${ent.slug}/${event.slug}` : '#';
  const hasClips = event.upload_count > 0;
  return (
    <li>
      <Link
        href={eventHref}
        className="grid grid-cols-[56px_1fr_auto] items-center gap-4 px-2 py-3 transition hover:bg-white/[0.03] md:grid-cols-[80px_1.2fr_1.5fr_auto_auto_20px]"
      >
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
          <span className="hidden md:inline">{formatShortDate(event.event_date)}</span>
          <span className="md:hidden">{shortDayMonth(event.event_date)}</span>
        </span>

        <span className="min-w-0 truncate">
          {ent ? (
            <span
              onClick={(e) => {
                e.preventDefault();
                window.location.href = `/${ent.slug}`;
              }}
              className="text-sm font-medium text-white hover:underline"
            >
              {ent.name}
            </span>
          ) : (
            <span className="text-sm text-gray-500">—</span>
          )}
        </span>

        <span className="hidden min-w-0 truncate text-[13px] text-gray-500 md:block">
          {event.venue_name}
          {event.city ? ` · ${event.city}` : ''}
        </span>

        <span
          className={`hidden shrink-0 text-right font-mono text-[11px] tabular-nums md:inline ${
            hasClips ? 'text-croll' : 'text-gray-600'
          }`}
        >
          {formatCount(event.upload_count)} clips
        </span>

        <span className="hidden shrink-0 text-right font-mono text-[11px] tabular-nums text-gray-500 md:inline">
          {formatCount(event.contributor_count)} contrib
        </span>

        <span className="hidden text-right text-gray-600 md:inline">→</span>

        {/* Mobile compact stats */}
        <span
          className={`text-right font-mono text-[11px] tabular-nums md:hidden ${
            hasClips ? 'text-croll' : 'text-gray-600'
          }`}
        >
          {formatCount(event.upload_count)}
        </span>
      </Link>
    </li>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <p className="py-24 text-center text-sm text-gray-500">Nothing here yet.</p>
  );
}

// ── Date helpers ────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return formatEventDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortDayMonth(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return String(d.getDate());
}
