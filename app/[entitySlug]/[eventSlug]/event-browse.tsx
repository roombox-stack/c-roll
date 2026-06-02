'use client';

// Browse tab for the event page (the new default experience).
//
// Two zones:
//   • Left rail: setlist filter (single-select) + section pills (multi-select).
//   • Right zone: responsive mosaic of all media, with an inline-expand card.
//
// All filtering / sorting is client-side against the pre-fetched `media` prop.
// No re-fetches on filter change.

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { CardLikeButton } from '@/components/card-like-button';
import { VideoPlayer } from '@/components/video-player';
import { formatCount, formatDuration } from '@/components/format';
import {
  SECTION_LABELS,
  SECTION_BADGE_LABELS,
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
  song_tag_source: string | null;
  section_tag: SectionTag | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  is_full_song: boolean;
  uploader_id: string | null;
  created_at: string;
}

type SortKey = 'views' | 'recent' | 'floor';
type TypeFilter = 'all' | 'video' | 'photo';
type SheetKey = 'song' | 'section' | 'sort' | null;

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


export function EventBrowse({
  media,
  setlist,
  eventName,
  eventDate,
}: {
  media: EventBrowseMedia[];
  setlist: string[];
  eventName: string;
  eventDate: string;
}) {
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<SectionTag>>(
    () => new Set(),
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [desktopModalId, setDesktopModalId] = useState<string | null>(null);
  const [openSheet, setOpenSheet] = useState<SheetKey>(null);
  const savedScrollY = useRef(0);

  // Community song tagging state
  const [tagMediaId, setTagMediaId] = useState<string | null>(null);
  // Optimistic overrides: mediaId → song_tag
  const [tagOverrides, setTagOverrides] = useState<Map<string, string>>(() => new Map());
  const [tagError, setTagError] = useState<string | null>(null);

  // Lock body scroll while fullscreen overlay, desktop modal, or bottom sheet is open.
  useEffect(() => {
    if (fullscreenId || openSheet || desktopModalId) {
      savedScrollY.current = window.scrollY;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      window.scrollTo({ top: savedScrollY.current, behavior: 'instant' });
    }
    return () => { document.body.style.overflow = ''; };
  }, [fullscreenId, openSheet, desktopModalId]);

  // Setlist data quality guard — strip non-song entries before rendering.
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

  // Per-song clip counts — from ALL media, not just the filtered set.
  const songCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of media) {
      if (item.song_tag) m.set(item.song_tag, (m.get(item.song_tag) ?? 0) + 1);
    }
    return m;
  }, [media]);

  // Per-section counts — for the CURRENT song filter.
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

  // Pre-type-filter scope.
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

  const fullscreenMedia = fullscreenId
    ? filtered.find((m) => m.id === fullscreenId) ??
      media.find((m) => m.id === fullscreenId) ??
      null
    : null;

  // Videos-only list for prev/next navigation inside the fullscreen overlay.
  const videoList = useMemo(() => filtered.filter((m) => m.file_type === 'video'), [filtered]);
  const fullscreenIdx = fullscreenId ? videoList.findIndex((m) => m.id === fullscreenId) : -1;

  const submitTag = useCallback(async (mediaId: string, song: string) => {
    setTagMediaId(null);
    // Optimistic update immediately
    setTagOverrides((prev) => new Map(prev).set(mediaId, song));
    try {
      const { getOrCreateClientSessionToken } = await import('@/lib/session');
      const sessionToken = getOrCreateClientSessionToken();
      const res = await fetch(`/api/media/${mediaId}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_tag: song, session_token: sessionToken }),
      });
      if (!res.ok && res.status !== 409) {
        setTagOverrides((prev) => { const m = new Map(prev); m.delete(mediaId); return m; });
        setTagError("Couldn't save tag, try again");
        setTimeout(() => setTagError(null), 3000);
      }
    } catch {
      setTagOverrides((prev) => { const m = new Map(prev); m.delete(mediaId); return m; });
      setTagError("Couldn't save tag, try again");
      setTimeout(() => setTagError(null), 3000);
    }
  }, []);

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

  // ── Chip labels ─────────────────────────────────────────────────────────────
  const songChipLabel = selectedSong ?? 'All songs';
  const sectionChipLabel =
    selectedSections.size === 0
      ? 'All sections'
      : selectedSections.size === 1
        ? SECTION_LABELS[Array.from(selectedSections)[0]]
        : `${selectedSections.size} sections`;
  const sortChipLabel =
    SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? 'Most viewed';

  return (
    <>
    {/* ── Tag song popover ────────────────────────────────────────────── */}
    {tagMediaId && cleanSetlist.length > 0 ? (
      <TagSongPopover
        setlist={cleanSetlist}
        eventName={eventName}
        eventDate={eventDate}
        onSelect={(song) => submitTag(tagMediaId, song)}
        onClose={() => setTagMediaId(null)}
      />
    ) : null}

    {/* ── Tag error toast ──────────────────────────────────────────────── */}
    {tagError ? (
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1a1a1a] px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/10">
        {tagError}
      </div>
    ) : null}

    {/* ── Mobile video fullscreen overlay ─────────────────────────────── */}
    {fullscreenMedia ? (
      <VideoFullscreenOverlay
        media={fullscreenMedia}
        onClose={() => setFullscreenId(null)}
        onPrev={fullscreenIdx > 0 ? () => setFullscreenId(videoList[fullscreenIdx - 1].id) : null}
        onNext={fullscreenIdx < videoList.length - 1 ? () => setFullscreenId(videoList[fullscreenIdx + 1].id) : null}
      />
    ) : null}

    {/* ── Desktop media modal overlay (photos + videos) ───────────────── */}
    {desktopModalId ? (() => {
      const dm = filtered.find(m => m.id === desktopModalId) ?? media.find(m => m.id === desktopModalId) ?? null;
      const dmIdx = filtered.findIndex(m => m.id === desktopModalId);
      return dm ? (
        <DesktopMediaModal
          media={dm}
          allMedia={media}
          mediaList={filtered}
          currentIdx={dmIdx}
          onClose={() => setDesktopModalId(null)}
          onNavigate={(id) => setDesktopModalId(id)}
        />
      ) : null;
    })() : null}

    {/* ── Bottom sheets (mobile) ───────────────────────────────────────── */}
    <BottomSheet open={openSheet === 'song'} onClose={() => setOpenSheet(null)} title="// STEP THROUGH THE SHOW">
      <SongSheet
        setlist={cleanSetlist}
        songCounts={songCounts}
        selectedSong={selectedSong}
        onSelect={(song) => { selectSong(song); setOpenSheet(null); }}
      />
    </BottomSheet>

    <BottomSheet open={openSheet === 'section'} onClose={() => setOpenSheet(null)} title="// FILTER BY SECTION">
      <SectionSheet
        sectionCounts={sectionCounts}
        selectedSections={selectedSections}
        onToggle={toggleSection}
        onClear={() => setSelectedSections(new Set())}
        onClose={() => setOpenSheet(null)}
      />
    </BottomSheet>

    <BottomSheet open={openSheet === 'sort'} onClose={() => setOpenSheet(null)} title="// SORT BY">
      <SortSheet
        sortKey={sortKey}
        onSelect={(key) => { setSortKey(key); setOpenSheet(null); }}
      />
    </BottomSheet>

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

      {/* ── Mobile filter rows ───────────────────────────────────────────── */}
      <div className="-mx-4 border-b border-white/5 px-4 pb-3 pt-1 md:hidden">
        {/* Row 1 — Media type toggles */}
        <div className="flex gap-1.5">
          <TypePill active={typeFilter === 'all'} count={typeCounts.all} onClick={() => setTypeFilter('all')}>ALL</TypePill>
          <TypePill active={typeFilter === 'video'} count={typeCounts.video} disabled={typeCounts.video === 0} onClick={() => setTypeFilter('video')}>VID</TypePill>
          <TypePill active={typeFilter === 'photo'} count={typeCounts.photo} disabled={typeCounts.photo === 0} onClick={() => setTypeFilter('photo')}>PIC</TypePill>
        </div>
        {/* Row 2 — Active filter chips (open bottom sheets) */}
        <div className="mt-2 flex gap-2">
          <FilterChip
            active={selectedSong !== null}
            onClick={() => setOpenSheet('song')}
          >
            {songChipLabel}
          </FilterChip>
          <FilterChip
            active={selectedSections.size > 0}
            onClick={() => setOpenSheet('section')}
          >
            {sectionChipLabel}
          </FilterChip>
          <FilterChip
            active={sortKey !== 'views'}
            onClick={() => setOpenSheet('sort')}
          >
            {sortChipLabel}
          </FilterChip>
        </div>
      </div>

      {/* ── Right zone — mosaic ─────────────────────────────────────────── */}
      <section className="min-w-0 flex-1 md:pl-6">
        {/* Active-filter summary — desktop only */}
        <p className="mb-3 hidden text-xs text-gray-500 md:block">
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

        {/* Type pills + sort dropdown — desktop only */}
        <div className="mb-4 hidden flex-wrap items-center justify-between gap-3 md:flex">
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
          <>
            {/* Mobile: 2-column flush portrait grid */}
            <div className="grid grid-cols-2 md:hidden" style={{ gap: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }}>
              {filtered.map((m) => {
                // Videos → fullscreen overlay; photos → inline expand
                if (m.file_type === 'photo' && m.id === expandedId && expandedMedia) {
                  return (
                    <ExpandedCard
                      key={m.id}
                      media={expandedMedia}
                      onClose={() => setExpandedId(null)}
                      mobile
                    />
                  );
                }
                return (
                  <MobileTile
                    key={m.id}
                    media={m}
                    songOverride={tagOverrides.get(m.id)}
                    canTag={cleanSetlist.length > 0}
                    onTagClick={() => setTagMediaId(m.id)}
                    onClick={() => {
                      if (m.file_type === 'video') {
                        setFullscreenId(m.id);
                      } else {
                        setExpandedId(m.id === expandedId ? null : m.id);
                      }
                    }}
                  />
                );
              })}
            </div>
            {/* Desktop: all tiles open the modal overlay */}
            <div
              className="hidden md:grid md:gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
            >
              {filtered.map((m) => (
                <MosaicTile
                  key={m.id}
                  media={m}
                  songOverride={tagOverrides.get(m.id)}
                  canTag={cleanSetlist.length > 0}
                  onTagClick={() => setTagMediaId(m.id)}
                  onClick={() => setDesktopModalId(m.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
    </>
  );
}

// ── Filter chip (Row 2 mobile) ───────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
        active
          ? 'border-transparent text-ink'
          : 'border-white/15 bg-white/5 text-gray-300'
      }`}
      style={active ? { backgroundColor: '#FFCC00' } : undefined}
    >
      <span className="max-w-[120px] truncate">{children}</span>
      <svg
        width="8"
        height="8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0 opacity-60"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

// ── Bottom sheet ─────────────────────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ transition: 'none' }}
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/70 transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
        onClick={onClose}
      />
      {/* Sheet panel */}
      <div
        className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-2xl bg-[#1a1a1a]"
        style={{
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-croll">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-gray-400 transition hover:bg-white/15"
            style={{ fontSize: '16px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Song sheet ───────────────────────────────────────────────────────────────

function SongSheet({
  setlist,
  songCounts,
  selectedSong,
  onSelect,
}: {
  setlist: string[];
  songCounts: Map<string, number>;
  selectedSong: string | null;
  onSelect: (song: string | null) => void;
}) {
  return (
    <ul className="divide-y divide-white/[0.06] pb-safe-or-6">
      <li>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex w-full items-center justify-between px-4 py-3.5 text-left transition ${
            selectedSong === null ? 'text-white' : 'text-gray-300'
          }`}
        >
          <span className="text-sm font-medium">All songs</span>
          {selectedSong === null ? (
            <CheckIcon />
          ) : (
            <span className="font-mono text-[10px] tabular-nums text-gray-500">
              {Array.from(songCounts.values()).reduce((a, b) => a + b, 0)}
            </span>
          )}
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
              onClick={() => !disabled && onSelect(song)}
              disabled={disabled}
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
                active
                  ? 'text-white'
                  : disabled
                    ? 'cursor-not-allowed text-gray-600'
                    : 'text-gray-300 active:bg-white/5'
              }`}
            >
              <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-gray-600">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{song}</span>
              {active ? (
                <CheckIcon />
              ) : (
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    count > 0 ? 'text-emerald-400' : 'text-gray-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Section sheet ────────────────────────────────────────────────────────────

function SectionSheet({
  sectionCounts,
  selectedSections,
  onToggle,
  onClear,
  onClose,
}: {
  sectionCounts: Map<SectionTag, number>;
  selectedSections: Set<SectionTag>;
  onToggle: (s: SectionTag) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <ul className="divide-y divide-white/[0.06] pb-safe-or-6">
      <li>
        <button
          type="button"
          onClick={() => { onClear(); onClose(); }}
          className={`flex w-full items-center justify-between px-4 py-3.5 text-left transition ${
            selectedSections.size === 0 ? 'text-white' : 'text-gray-300 active:bg-white/5'
          }`}
        >
          <span className="text-sm font-medium">All sections</span>
          {selectedSections.size === 0 && <CheckIcon />}
        </button>
      </li>
      {SECTION_FILTERS.map((s) => {
        const count = sectionCounts.get(s) ?? 0;
        const active = selectedSections.has(s);
        const disabled = count === 0;
        return (
          <li key={s}>
            <button
              type="button"
              onClick={() => !disabled && onToggle(s)}
              disabled={disabled}
              className={`flex w-full items-center justify-between px-4 py-3.5 text-left transition ${
                active
                  ? 'text-white'
                  : disabled
                    ? 'cursor-not-allowed text-gray-600'
                    : 'text-gray-300 active:bg-white/5'
              }`}
            >
              <span className="text-sm">{SECTION_LABELS[s]}</span>
              <span className="flex items-center gap-2">
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? 'text-white/60' : count > 0 ? 'text-gray-500' : 'text-gray-700'
                  }`}
                >
                  {count}
                </span>
                {active && <CheckIcon />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Sort sheet ───────────────────────────────────────────────────────────────

function SortSheet({
  sortKey,
  onSelect,
}: {
  sortKey: SortKey;
  onSelect: (key: SortKey) => void;
}) {
  return (
    <ul className="divide-y divide-white/[0.06] pb-safe-or-6">
      {SORT_OPTIONS.map((o) => (
        <li key={o.value}>
          <button
            type="button"
            onClick={() => onSelect(o.value)}
            className={`flex w-full items-center justify-between px-4 py-3.5 text-left transition ${
              sortKey === o.value ? 'text-white' : 'text-gray-300 active:bg-white/5'
            }`}
          >
            <span className="text-sm">{o.label}</span>
            {sortKey === o.value && <CheckIcon />}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Shared check icon ────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFCC00"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Tag song popover ─────────────────────────────────────────────────────────

function TagSongPopover({
  setlist,
  eventName,
  eventDate,
  onSelect,
  onClose,
}: {
  setlist: string[];
  eventName: string;
  eventDate: string;
  onSelect: (song: string) => void;
  onClose: () => void;
}) {
  const formattedDate = useMemo(() => {
    try {
      return new Date(eventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return eventDate;
    }
  }, [eventDate]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    // Backdrop — closes on outside tap
    <div
      className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
      onClick={onClose}
    >
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      {/* Sheet / popover */}
      <div
        className="relative z-10 w-full max-w-sm rounded-t-2xl bg-[#141414] ring-1 ring-white/10 md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-white/[0.08] px-4 py-3">
          <p className="text-sm font-medium text-white">{eventName}</p>
          <p className="mt-0.5 font-mono text-[11px] text-gray-400">{formattedDate}</p>
        </div>

        {/* Song list */}
        <ul className="max-h-72 overflow-y-auto overscroll-contain divide-y divide-white/[0.06] pb-safe-or-4">
          {setlist.map((song, i) => (
            <li key={`${song}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(song)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/5 hover:bg-white/5"
              >
                <span className="w-5 shrink-0 font-mono text-[10px] text-gray-500 tabular-nums text-right">{i + 1}</span>
                <span className="text-sm text-gray-100">{song}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Cancel */}
        <div className="border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 text-sm text-gray-400 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
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
            <span className="font-medium">Setlist</span>
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

// ── Mobile video fullscreen overlay ─────────────────────────────────────────

function VideoFullscreenOverlay({
  media,
  onClose,
  onPrev,
  onNext,
}: {
  media: EventBrowseMedia;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const song = cleanLabel(media.song_tag);

  // Swipe-down to close
  const touchStartY = useRef(0);
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches[0].clientY - touchStartY.current > 60) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Video fills the full viewport height */}
      <div className="absolute inset-0">
        {media.mux_playback_id ? (
          <VideoPlayer
            playbackId={media.mux_playback_id}
            autoPlay
            poster={media.thumbnail_url ?? undefined}
            fullscreen
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
            Video unavailable
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
        style={{ fontSize: '20px' }}
      >
        ×
      </button>

      {/* Prev / Next arrows — vertically centred, outside the swipe zone */}
      {onPrev ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Previous video"
          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Next video"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ) : null}

      {/* Metadata strip — bottom of screen */}
      <div
        className="absolute inset-x-0 bottom-0 px-4 pb-6 pt-16"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
      >
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {media.section_tag ? (
            <span
              className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest"
              style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
            >
              {SECTION_BADGE_LABELS[media.section_tag]}
            </span>
          ) : null}
          {song ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
              {song}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-gray-400">
            {formatCount(media.view_count)} views
          </span>
          <div className="flex items-center gap-2">
            <CardLikeButton mediaId={media.id} initialLikeCount={media.like_count} />
            <ShareButton mediaId={media.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile tile (2-column flush portrait grid) ────────────────────────────────

function MobileTile({
  media,
  onClick,
  songOverride,
  onTagClick,
  canTag,
}: {
  media: EventBrowseMedia;
  onClick: () => void;
  songOverride?: string;
  onTagClick?: () => void;
  canTag?: boolean;
}) {
  const isVideo = media.file_type === 'video';
  const thumb = media.thumbnail_url ?? (isVideo ? null : media.storage_url);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block aspect-[3/4] w-full overflow-hidden bg-smoke"
    >
      {thumb ? (
        <Image
          src={thumb}
          alt=""
          fill
          sizes="33vw"
          className="object-cover"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
      )}

      {/* View count — bottom-left */}
      <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 font-mono text-[10px] tabular-nums text-white">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
        {formatCount(media.view_count)}
      </span>

      {/* Duration — bottom-right (videos only) */}
      {isVideo && media.duration_sec ? (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[10px] tabular-nums text-white">
          {formatDuration(media.duration_sec)}
        </span>
      ) : null}

      {/* Song tag or tag affordance — top-left overlay */}
      {(songOverride ?? media.song_tag) ? (
        <span className="absolute left-1 top-1 max-w-[80%] truncate rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/70 backdrop-blur">
          {songOverride ?? media.song_tag}
        </span>
      ) : canTag && onTagClick && isVideo ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTagClick(); }}
          className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-white/60 transition hover:text-white/90"
        >
          <span style={{ color: '#FFCC00' }}>♪</span>
          Tag
          <span style={{ color: '#FFCC00' }}>→</span>
        </button>
      ) : null}
    </button>
  );
}

// ── Mosaic tile ─────────────────────────────────────────────────────────────

function MosaicTile({
  media,
  onClick,
  songOverride,
  onTagClick,
  canTag,
}: {
  media: EventBrowseMedia;
  onClick: () => void;
  songOverride?: string;
  onTagClick?: () => void;
  canTag?: boolean;
}) {
  const isVideo = media.file_type === 'video';
  const thumb = media.thumbnail_url ?? (isVideo ? null : media.storage_url);
  const song = songOverride ? songOverride : cleanLabel(media.song_tag);
  const aspect = 'aspect-[3/4]';

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
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest"
          style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
        >
          {SECTION_BADGE_LABELS[media.section_tag]}
        </span>
      ) : null}

      {/* Duration top-right (videos only) */}
      {isVideo && media.duration_sec ? (
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
          {formatDuration(media.duration_sec)}
        </span>
      ) : null}

      {/* Song tag or tag affordance bottom-left */}
      {song ? (
        <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
          {song}
        </span>
      ) : canTag && onTagClick && isVideo ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTagClick(); }}
          className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60 backdrop-blur transition hover:bg-white/20 hover:text-white/90"
        >
          <span style={{ color: '#FFCC00' }}>♪</span>
          Tag song
          <span style={{ color: '#FFCC00' }}>→</span>
        </button>
      ) : null}

    </button>
  );
}

// ── Expanded card ───────────────────────────────────────────────────────────

function ExpandedCard({
  media,
  onClose,
  mobile = false,
}: {
  media: EventBrowseMedia;
  onClose: () => void;
  mobile?: boolean;
}) {
  const isVideo = media.file_type === 'video';
  const song = cleanLabel(media.song_tag);
  const caption = cleanLabel(media.caption);
  return (
    <div
      className="relative overflow-hidden border bg-[#141414] md:rounded-lg"
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
                className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest"
                style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
              >
                {SECTION_BADGE_LABELS[media.section_tag]}
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
            <span className="font-mono text-xs text-gray-400">
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

// ── Desktop media modal overlay (md+ only) — handles both photos and videos ──

function DesktopMediaModal({
  media,
  allMedia,
  mediaList,
  currentIdx,
  onClose,
  onNavigate,
}: {
  media: EventBrowseMedia;
  allMedia: EventBrowseMedia[];
  mediaList: EventBrowseMedia[];
  currentIdx: number;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const song = cleanLabel(media.song_tag);
  const caption = cleanLabel(media.caption);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < mediaList.length - 1;

  const moreFromShow = allMedia
    .filter((m) => m.id !== media.id)
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5);

  const uploaderHandle = media.uploader_id
    ? `@${media.uploader_id.slice(0, 8)}`
    : '@fan';

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(mediaList[currentIdx - 1].id);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(mediaList[currentIdx + 1].id);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hasPrev, hasNext, currentIdx, mediaList, onClose, onNavigate]);

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes croll-backdrop-in { from { opacity:0 } to { opacity:1 } }
        @keyframes croll-modal-in { from { opacity:0; transform:scale(0.96) } to { opacity:1; transform:scale(1) } }
      `}</style>

      {/* Full-viewport overlay — hidden on mobile */}
      <div
        className="fixed inset-0 z-50 hidden md:flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(0,0,0,0.88)',
            animation: 'croll-backdrop-in 150ms ease forwards',
          }}
          onClick={onClose}
        />

        {/* Modal panel */}
        <div
          className="relative z-10 flex overflow-hidden"
          style={{
            width: '95vw',
            maxWidth: '1600px',
            height: '90vh',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 32px 96px rgba(0,0,0,0.9)',
            animation: 'croll-modal-in 150ms ease forwards',
          }}
        >
          {/* ── Left: video player ──── */}
          <div
            className="relative bg-black"
            style={{ flex: '0 0 75%', height: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: '100%', height: '100%' }}>
              {media.file_type === 'video' ? (
                media.mux_playback_id ? (
                  <VideoPlayer
                    playbackId={media.mux_playback_id}
                    autoPlay
                    poster={media.thumbnail_url ?? undefined}
                    fillHeight
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                    Video unavailable
                  </div>
                )
              ) : (
                // Photo
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.storage_url}
                  alt={song ?? caption ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
            </div>

            {/* Prev arrow */}
            {hasPrev ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigate(mediaList[currentIdx - 1].id); }}
                aria-label="Previous video"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            ) : null}

            {/* Next arrow */}
            {hasNext ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigate(mediaList[currentIdx + 1].id); }}
                aria-label="Next video"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ) : null}
          </div>

          {/* ── Right: metadata panel ── */}
          <div
            className="flex flex-col overflow-y-auto"
            style={{ flex: '0 0 25%', background: '#0d0d0d', padding: '24px' }}
          >
            {/* Section badge */}
            {media.section_tag ? (
              <span
                className="mb-2 self-start rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest"
                style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
              >
                {SECTION_BADGE_LABELS[media.section_tag]}
              </span>
            ) : null}

            {/* Song tag */}
            {song ? (
              <span className="mb-2 self-start rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
                {song}
              </span>
            ) : null}

            {/* Caption */}
            {caption ? (
              <p className="mb-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {caption}
              </p>
            ) : null}

            {/* Uploader + views */}
            <p className="text-[13px] text-gray-500">{uploaderHandle}</p>
            <p className="mt-0.5 text-[13px] text-gray-500">{formatCount(media.view_count)} views</p>

            {/* Divider */}
            <div className="my-4 h-px bg-white/10" />

            {/* Like button */}
            <div className="mb-2">
              <CardLikeButton
                mediaId={media.id}
                initialLikeCount={media.like_count}
                className="w-full justify-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              />
            </div>

            {/* Share button */}
            <ModalShareButton mediaId={media.id} />

            {/* Divider */}
            <div className="my-4 h-px bg-white/10" />

            {/* More from this show */}
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-gray-600">
              More from this show
            </p>
            {moreFromShow.length === 0 ? (
              <p className="text-xs text-gray-600">No other clips yet.</p>
            ) : (
              <ul className="space-y-2">
                {moreFromShow.map((m) => {
                  const thumb = m.thumbnail_url ?? null;
                  const mSong = cleanLabel(m.song_tag);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(m.id)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-white/5"
                      >
                        {/* Thumbnail 48×32 */}
                        <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded bg-smoke">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-600 text-[10px]">▶</div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-gray-300">
                            {mSong ?? (m.duration_sec ? formatDuration(m.duration_sec) : 'Video')}
                          </p>
                          <p className="text-[11px] text-gray-600">{formatCount(m.view_count)} views</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* X close button — inside modal, top-right corner */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute flex items-center justify-center rounded-full text-white transition z-20"
          style={{
            top: '12px',
            right: '12px',
            width: '36px',
            height: '36px',
            background: 'rgba(255,255,255,0.1)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </>
  );
}

function ModalShareButton({ mediaId }: { mediaId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${window.location.pathname}?clip=${mediaId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* blocked */ }
      }}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {copied ? 'Copied!' : 'Share'}
    </button>
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
