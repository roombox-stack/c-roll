'use client';

// Browse tab for the event page (the new default experience).
//
// Two zones:
//   • Left rail: setlist filter (single-select) + section pills (multi-select).
//   • Right zone: responsive mosaic of all media, with an inline-expand card.
//
// All filtering / sorting is client-side against the pre-fetched `media` prop.
// No re-fetches on filter change.

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { CardLikeButton } from '@/components/card-like-button';
import { VideoPlayer } from '@/components/video-player';
import { formatCount, formatDuration } from '@/components/format';
import {
  SECTION_LABELS,
  SECTION_ORDER,
  type SectionTag,
} from '@/lib/types';

export interface EventBrowseMedia {
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
  uploader_id: string | null;
  upload_session: string | null;
  created_at: string;
}

type SortKey = 'views' | 'recent' | 'floor';
type TypeFilter = 'all' | 'video' | 'photo';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'views', label: 'Most viewed' },
  { value: 'recent', label: 'Most recent' },
  { value: 'floor', label: 'Floor/Pit first' },
];

const SECTION_FILTERS: SectionTag[] = [
  'floor',
  'section_100',
  'section_200',
  'upper',
  'stage_left',
  'stage_right',
];

// Used by the "Floor/Pit first" sort to bias floor / pit clips to the top.
const FLOOR_RANK: Record<string, number> = {
  floor: 0,
  pit: 0,
  section_100: 1,
  section_200: 2,
  upper: 3,
  stage_left: 4,
  stage_right: 5,
};

function cleanLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t.startsWith('untitled')) return null;
  return s.trim();
}

function handleFor(m: EventBrowseMedia): string {
  if (m.uploader_id) return `@${m.uploader_id.slice(0, 8)}`;
  if (m.upload_session) return `@anon ${m.upload_session.slice(0, 6)}`;
  return '@anon';
}

export function EventBrowse({
  media,
  setlist,
}: {
  media: EventBrowseMedia[];
  setlist: string[];
}) {
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<SectionTag>>(
    () => new Set(),
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Setlist data quality guard — strip non-song entries before rendering.
  // Some events have "Play Video", empty strings, or other UI labels mixed
  // into their setlist JSON. We filter those out here rather than touching
  // the data so the component stays robust to whatever Supabase returns.
  const cleanSetlist = useMemo(
    () =>
      setlist.filter((s) => {
        if (typeof s !== 'string') return false;
        const t = s.trim();
        if (!t) return false;
        if (t.toLowerCase() === 'play video') return false;
        return true;
      }),
    [setlist],
  );

  // Per-song clip counts — from ALL media, not just the filtered set, so the
  // setlist always reflects what's possible to filter to.
  const songCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of media) {
      if (item.song_tag) m.set(item.song_tag, (m.get(item.song_tag) ?? 0) + 1);
    }
    return m;
  }, [media]);

  // Per-section counts — for the CURRENT song filter (so sections that have
  // zero clips of the active song get dimmed/disabled).
  const sectionCounts = useMemo(() => {
    const m = new Map<SectionTag, number>();
    const scope = selectedSong
      ? media.filter((x) => x.song_tag === selectedSong)
      : media;
    for (const item of scope) {
      if (item.section_tag) {
        m.set(item.section_tag, (m.get(item.section_tag) ?? 0) + 1);
      }
    }
    return m;
  }, [media, selectedSong]);

  // Pre-type-filter scope — used both for the final filtered list AND for
  // computing the All/Videos/Photos counts so the pill labels stay accurate
  // as the song + section filters change.
  const songSectionScope = useMemo(() => {
    let list = media;
    if (selectedSong) list = list.filter((m) => m.song_tag === selectedSong);
    if (selectedSections.size > 0) {
      list = list.filter(
        (m) => m.section_tag && selectedSections.has(m.section_tag),
      );
    }
    return list;
  }, [media, selectedSong, selectedSections]);

  const typeCounts = useMemo(() => {
    let video = 0;
    let photo = 0;
    for (const m of songSectionScope) {
      if (m.file_type === 'video') video += 1;
      else if (m.file_type === 'photo') photo += 1;
    }
    return { all: songSectionScope.length, video, photo };
  }, [songSectionScope]);

  // Compose filters → sort.
  const filtered = useMemo(() => {
    let list = songSectionScope;
    if (typeFilter === 'video') list = list.filter((m) => m.file_type === 'video');
    else if (typeFilter === 'photo') list = list.filter((m) => m.file_type === 'photo');
    const sorted = list.slice();
    switch (sortKey) {
      case 'views':
        sorted.sort((a, b) => b.view_count - a.view_count);
        break;
      case 'recent':
        sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        break;
      case 'floor':
        sorted.sort((a, b) => {
          const ra = a.section_tag ? (FLOOR_RANK[a.section_tag] ?? 99) : 99;
          const rb = b.section_tag ? (FLOOR_RANK[b.section_tag] ?? 99) : 99;
          if (ra !== rb) return ra - rb;
          return b.view_count - a.view_count;
        });
        break;
    }
    return sorted;
  }, [songSectionScope, typeFilter, sortKey]);

  const expandedMedia = expandedId
    ? filtered.find((m) => m.id === expandedId) ??
      media.find((m) => m.id === expandedId) ??
      null
    : null;

  function toggleSection(s: SectionTag) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function selectSong(song: string | null) {
    setSelectedSong(song);
    setExpandedId(null);
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-0">
      {/* ── Left rail (desktop) ─────────────────────────────────────────── */}
      <aside className="hidden md:block md:w-[220px] md:shrink-0 md:self-start md:border-r md:border-white/[0.08] md:bg-[#0d0d0d] md:pr-4">
        <SetlistList
          setlist={cleanSetlist}
          songCounts={songCounts}
          selectedSong={selectedSong}
          onSelectSong={selectSong}
        />
        <div className="mt-8">
          <SectionFiltersBlock
            sectionCounts={sectionCounts}
            selectedSections={selectedSections}
            onToggle={toggleSection}
          />
        </div>
      </aside>

      {/* ── Left rail (mobile — horizontal scroll) ──────────────────────── */}
      <div className="-mx-4 space-y-3 border-b border-white/5 px-4 pb-4 md:hidden">
        <MobileSongPills
          setlist={cleanSetlist}
          songCounts={songCounts}
          selectedSong={selectedSong}
          onSelectSong={selectSong}
        />
        <MobileSectionPills
          sectionCounts={sectionCounts}
          selectedSections={selectedSections}
          onToggle={toggleSection}
        />
      </div>

      {/* ── Right zone — mosaic ─────────────────────────────────────────── */}
      <section className="min-w-0 flex-1 md:pl-6">
        {/* Active-filter summary (count chip reflects ALL three filters) */}
        <p className="mb-3 text-xs text-gray-500">
          <span className="text-gray-300">{formatCount(filtered.length)}</span> clip
          {filtered.length === 1 ? '' : 's'}
          {selectedSong ? (
            <>
              <span className="mx-1.5 text-ash">·</span>
              <span className="text-white">{selectedSong}</span>
            </>
          ) : null}
          {selectedSections.size > 0 ? (
            <>
              <span className="mx-1.5 text-ash">·</span>
              <span className="text-white">
                {Array.from(selectedSections)
                  .map((s) => SECTION_LABELS[s])
                  .join(' · ')}
              </span>
            </>
          ) : null}
          {typeFilter !== 'all' ? (
            <>
              <span className="mx-1.5 text-ash">·</span>
              <span className="text-white">
                {typeFilter === 'video' ? 'Videos' : 'Photos'}
              </span>
            </>
          ) : null}
        </p>

        {/* Type pills (left) + sort dropdown (right) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <TypePill
              active={typeFilter === 'all'}
              count={typeCounts.all}
              onClick={() => setTypeFilter('all')}
            >
              All
            </TypePill>
            <TypePill
              active={typeFilter === 'video'}
              count={typeCounts.video}
              disabled={typeCounts.video === 0}
              onClick={() => setTypeFilter('video')}
            >
              Videos
            </TypePill>
            <TypePill
              active={typeFilter === 'photo'}
              count={typeCounts.photo}
              disabled={typeCounts.photo === 0}
              onClick={() => setTypeFilter('photo')}
            >
              Photos
            </TypePill>
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none transition hover:border-white/20 focus:border-white/30"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-ink text-white">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            {selectedSong
              ? 'No clips tagged to this song yet.'
              : 'No clips match the current filters.'}
          </p>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
          >
            {filtered.map((m) => {
              if (m.id === expandedId && expandedMedia) {
                return (
                  <ExpandedCard
                    key={m.id}
                    media={expandedMedia}
                    onClose={() => setExpandedId(null)}
                  />
                );
              }
              return (
                <MosaicTile
                  key={m.id}
                  media={m}
                  onClick={() => setExpandedId(m.id)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Setlist list (desktop) ──────────────────────────────────────────────────

function SetlistList({
  setlist,
  songCounts,
  selectedSong,
  onSelectSong,
}: {
  setlist: string[];
  songCounts: Map<string, number>;
  selectedSong: string | null;
  onSelectSong: (song: string | null) => void;
}) {
  return (
    <div>
      <p className="px-2.5 font-mono text-[10px] uppercase tracking-widest text-croll">
        // STEP THROUGH THE SHOW
      </p>
      <ul className="mt-3 space-y-px">
        <li>
          <button
            type="button"
            onClick={() => onSelectSong(null)}
            className={`flex w-full items-center justify-between rounded-r px-2.5 py-2 text-left text-sm transition ${
              selectedSong === null
                ? 'border-l-2 border-croll bg-croll/[0.06] text-white'
                : 'border-l-2 border-transparent text-gray-300 hover:bg-white/[0.03] hover:text-white'
            }`}
          >
            <span className="font-medium">All clips</span>
            <span
              className={`font-mono text-[10px] tabular-nums ${
                selectedSong === null ? 'text-croll' : 'text-gray-600'
              }`}
            >
              {Array.from(songCounts.values()).reduce((a, b) => a + b, 0) || 0}
            </span>
          </button>
        </li>
        {setlist.map((song, i) => {
          const count = songCounts.get(song) ?? 0;
          const active = selectedSong === song;
          const disabled = count === 0;
          return (
            <li key={song + i}>
              <button
                type="button"
                onClick={() => !disabled && onSelectSong(song)}
                disabled={disabled}
                className={`flex w-full items-center gap-3 rounded-r px-2.5 py-2 text-left text-sm transition ${
                  active
                    ? 'border-l-2 border-croll bg-croll/[0.06] text-white'
                    : disabled
                      ? 'cursor-not-allowed border-l-2 border-transparent text-gray-600'
                      : 'border-l-2 border-transparent text-gray-300 hover:bg-white/[0.03] hover:text-white'
                }`}
              >
                <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-gray-600">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1 truncate">{song}</span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active
                      ? 'text-croll'
                      : count > 0
                        ? 'text-emerald-400'
                        : 'text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Section filters (desktop) ───────────────────────────────────────────────

function SectionFiltersBlock({
  sectionCounts,
  selectedSections,
  onToggle,
}: {
  sectionCounts: Map<SectionTag, number>;
  selectedSections: Set<SectionTag>;
  onToggle: (s: SectionTag) => void;
}) {
  return (
    <div>
      <p className="px-2.5 font-mono text-[10px] uppercase tracking-widest text-croll">
        // FILTER BY SECTION
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5 px-2.5">
        {SECTION_FILTERS.map((s) => {
          const count = sectionCounts.get(s) ?? 0;
          const disabled = count === 0;
          const active = selectedSections.has(s);
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(s)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                active
                  ? 'border-croll bg-croll text-ink'
                  : disabled
                    ? 'cursor-not-allowed border-white/5 bg-white/5 text-gray-600'
                    : 'border-white/15 bg-white/5 text-gray-300 hover:border-white/30 hover:text-white'
              }`}
            >
              {SECTION_LABELS[s]}
              <span className={`ml-1 tabular-nums ${active ? 'text-ink/70' : ''}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mobile filter rows ──────────────────────────────────────────────────────

function MobileSongPills({
  setlist,
  songCounts,
  selectedSong,
  onSelectSong,
}: {
  setlist: string[];
  songCounts: Map<string, number>;
  selectedSong: string | null;
  onSelectSong: (song: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-croll">
        // STEP THROUGH THE SHOW
      </p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        <PillButton
          active={selectedSong === null}
          onClick={() => onSelectSong(null)}
          disabled={false}
        >
          All clips
        </PillButton>
        {setlist.map((song, i) => {
          const count = songCounts.get(song) ?? 0;
          const disabled = count === 0;
          return (
            <PillButton
              key={song + i}
              active={selectedSong === song}
              onClick={() => !disabled && onSelectSong(song)}
              disabled={disabled}
            >
              <span className="mr-1.5 font-mono text-[10px] text-gray-500">
                {String(i + 1).padStart(2, '0')}
              </span>
              {song}
              <span
                className={`ml-1.5 font-mono text-[10px] tabular-nums ${
                  count > 0 ? 'text-emerald-400' : 'text-gray-500'
                }`}
              >
                {count}
              </span>
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}

function MobileSectionPills({
  sectionCounts,
  selectedSections,
  onToggle,
}: {
  sectionCounts: Map<SectionTag, number>;
  selectedSections: Set<SectionTag>;
  onToggle: (s: SectionTag) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-croll">
        // FILTER BY SECTION
      </p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        {SECTION_FILTERS.map((s) => {
          const count = sectionCounts.get(s) ?? 0;
          const disabled = count === 0;
          return (
            <PillButton
              key={s}
              active={selectedSections.has(s)}
              onClick={() => onToggle(s)}
              disabled={disabled}
              mono
            >
              {SECTION_LABELS[s]}
              <span className="ml-1 font-mono text-[10px] tabular-nums">{count}</span>
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  disabled,
  mono = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
        mono ? 'font-mono uppercase tracking-widest' : ''
      } ${
        active
          ? 'border-croll bg-croll text-ink'
          : disabled
            ? 'cursor-not-allowed border-white/5 bg-white/5 text-gray-600'
            : 'border-white/15 bg-white/5 text-gray-300 hover:border-white/30 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// ── Type pill (All / Videos / Photos) ──────────────────────────────────────

function TypePill({
  active,
  count,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
        active
          ? 'border-croll bg-croll text-ink'
          : disabled
            ? 'cursor-not-allowed border-white/5 bg-white/5 text-gray-600'
            : 'border-white/15 bg-white/5 text-gray-300 hover:border-white/30 hover:text-white'
      }`}
    >
      {children}
      <span className={`ml-1.5 tabular-nums ${active ? 'text-ink/70' : ''}`}>
        · {count}
      </span>
    </button>
  );
}

// ── Mosaic tile ─────────────────────────────────────────────────────────────

function MosaicTile({
  media,
  onClick,
}: {
  media: EventBrowseMedia;
  onClick: () => void;
}) {
  const isVideo = media.file_type === 'video';
  const thumb = media.thumbnail_url ?? (isVideo ? null : media.storage_url);
  const song = cleanLabel(media.song_tag);
  const aspect = isVideo ? 'aspect-video' : 'aspect-[4/5]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block overflow-hidden rounded-lg bg-smoke text-left transition hover:ring-1 hover:ring-white/20 ${aspect}`}
    >
      {thumb ? (
        <Image
          src={thumb}
          alt={song ?? ''}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition group-hover:scale-[1.02]"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
      )}
      {/* Section badge top-left */}
      {media.section_tag ? (
        <span
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest"
          style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
        >
          {SECTION_LABELS[media.section_tag]}
        </span>
      ) : null}

      {/* Duration top-right (videos only) */}
      {isVideo && media.duration_sec ? (
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
          {formatDuration(media.duration_sec)}
        </span>
      ) : null}

      {/* Song tag bottom-left */}
      {song ? (
        <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
          {song}
        </span>
      ) : null}

      {/* Bottom bar — hover only (desktop), always visible (mobile) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 transition group-hover:opacity-100 md:opacity-0">
        <span className="truncate font-mono text-[10px] text-white/80">
          {handleFor(media)}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-white/80">
          {formatCount(media.view_count)} views
        </span>
      </div>
    </button>
  );
}

// ── Expanded card ───────────────────────────────────────────────────────────

function ExpandedCard({
  media,
  onClose,
}: {
  media: EventBrowseMedia;
  onClose: () => void;
}) {
  const isVideo = media.file_type === 'video';
  const song = cleanLabel(media.song_tag);
  const caption = cleanLabel(media.caption);
  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-[#141414]"
      style={{ gridColumn: '1 / -1', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
      >
        ×
      </button>

      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <div className="relative bg-black">
          {isVideo && media.mux_playback_id ? (
            <VideoPlayer
              playbackId={media.mux_playback_id}
              autoPlay
              poster={media.thumbnail_url ?? undefined}
            />
          ) : (
            <div className="relative aspect-[4/5] md:aspect-auto md:h-full">
              <Image
                src={media.storage_url}
                alt={song ?? caption ?? ''}
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-contain"
                unoptimized
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {media.section_tag ? (
              <span
                className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest"
                style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
              >
                {SECTION_LABELS[media.section_tag]}
              </span>
            ) : null}
            {song ? (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                {song}
              </span>
            ) : null}
            {isVideo && media.duration_sec ? (
              <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
                {formatDuration(media.duration_sec)}
              </span>
            ) : null}
          </div>

          {caption ? (
            <p className="text-sm leading-relaxed text-gray-300">{caption}</p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/5 pt-3">
            <span className="truncate font-mono text-xs text-gray-400">
              {handleFor(media)}
              <span className="mx-1.5 text-ash">·</span>
              {formatCount(media.view_count)} views
            </span>
            <div className="flex items-center gap-2">
              <CardLikeButton
                mediaId={media.id}
                initialLikeCount={media.like_count}
              />
              <ShareButton mediaId={media.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareButton({ mediaId }: { mediaId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/watch/${mediaId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked — silently ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}
