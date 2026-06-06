'use client';

// Client-side interactive layer for the entity page.
// Manages modal state for HeroGrid tiles and HighlightsGrid tiles.
// The entity desktop modal mirrors the event-browse DesktopMediaModal but adds
// a "Watch this show" link and scopes "More from this show" to the same event.

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { CardLikeButton } from '@/components/card-like-button';
import { VideoPlayer } from '@/components/video-player';
import { HighlightsGrid, type HighlightItem } from '@/components/highlights-grid';
import { formatCount, formatDuration } from '@/components/format';
import { SECTION_BADGE_LABELS } from '@/lib/types';
import type { SectionTag } from '@/lib/types';

export interface EntityEventSummary {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  event_date: string;
}

export interface EntityMediaItem extends HighlightItem {
  event_id: string | null;
  section_tag: SectionTag | null;
  uploader_id?: string | null;
}

function cleanLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t.startsWith('untitled')) return null;
  return s.trim();
}

// ── Hero grid ─────────────────────────────────────────────────────────────────

export function EntityHeroGrid({
  media,
  eventCityMap,
  onItemClick,
}: {
  media: EntityMediaItem[];
  eventCityMap: Map<string, string>;
  onItemClick: (id: string) => void;
}) {
  const slots = Array.from({ length: 6 }, (_, i) => media[i] ?? null);
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2">
      {slots.map((m, i) => (
        <EntityHeroThumb
          key={m?.id ?? `empty-${i}`}
          media={m}
          city={m?.event_id ? (eventCityMap.get(m.event_id) ?? null) : null}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}

function EntityHeroThumb({
  media,
  city,
  onItemClick,
}: {
  media: EntityMediaItem | null;
  city: string | null;
  onItemClick: (id: string) => void;
}) {
  if (!media) {
    return <div className="aspect-[4/5] rounded-lg bg-white/5" />;
  }
  const thumb = media.thumbnail_url ?? (media.file_type === 'photo' ? media.storage_url : null);
  const isVideo = media.file_type === 'video';
  const rawLabel = media.song_tag ?? media.caption ?? '';
  const label = cleanLabel(rawLabel);

  return (
    <button
      type="button"
      onClick={() => onItemClick(media.id)}
      className="group relative block aspect-[4/5] overflow-hidden rounded-lg bg-smoke w-full"
    >
      {thumb ? (
        <Image
          src={thumb}
          alt={label ?? ''}
          fill
          sizes="160px"
          className="object-cover transition group-hover:scale-105"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-ash to-smoke" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10" />

      {city ? (
        <span
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest"
          style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
        >
          {city.toUpperCase()}
        </span>
      ) : null}

      {isVideo ? (
        <div className="absolute inset-0 flex items-center justify-center transition group-hover:scale-110">
          <div className="rounded-full bg-white/90 p-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="black" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      ) : null}

      {label ? (
        <span className="absolute inset-x-1.5 bottom-1.5 truncate text-[10px] font-medium text-white">
          {label}
        </span>
      ) : null}
    </button>
  );
}

// ── Entity desktop modal ──────────────────────────────────────────────────────

function EntityDesktopModal({
  media,
  allMedia,
  mediaList,
  currentIdx,
  entitySlug,
  eventMap,
  onClose,
  onNavigate,
}: {
  media: EntityMediaItem;
  allMedia: EntityMediaItem[];
  mediaList: EntityMediaItem[];
  currentIdx: number;
  entitySlug: string;
  eventMap: Map<string, EntityEventSummary>;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const song = cleanLabel(media.song_tag);
  const caption = cleanLabel(media.caption);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < mediaList.length - 1;
  const event = media.event_id ? eventMap.get(media.event_id) ?? null : null;

  const moreFromShow = allMedia
    .filter((m) => m.id !== media.id && m.event_id === media.event_id)
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5);

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
      <style>{`
        @keyframes croll-backdrop-in { from { opacity:0 } to { opacity:1 } }
        @keyframes croll-modal-in { from { opacity:0; transform:scale(0.96) } to { opacity:1; transform:scale(1) } }
      `}</style>

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
          {/* Left: player */}
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.storage_url}
                  alt={song ?? caption ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
            </div>

            {hasPrev ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigate(mediaList[currentIdx - 1].id); }}
                aria-label="Previous"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            ) : null}

            {hasNext ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigate(mediaList[currentIdx + 1].id); }}
                aria-label="Next"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ) : null}
          </div>

          {/* Right: metadata panel */}
          <div
            className="flex flex-col overflow-y-auto"
            style={{ flex: '0 0 25%', background: '#0d0d0d', padding: '24px' }}
          >
            {media.section_tag ? (
              <span
                className="mb-2 self-start rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest"
                style={{ backgroundColor: 'rgba(255,204,0,0.15)', color: '#FFCC00' }}
              >
                {SECTION_BADGE_LABELS[media.section_tag]}
              </span>
            ) : null}

            {song ? (
              <span className="mb-2 self-start rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
                {song}
              </span>
            ) : null}

            {caption ? (
              <p className="mb-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {caption}
              </p>
            ) : null}

            <p className="text-[13px] text-gray-500">{formatCount(media.view_count)} views</p>

            <div className="my-4 h-px bg-white/10" />

            {/* Like */}
            <div className="mb-2">
              <CardLikeButton
                mediaId={media.id}
                initialLikeCount={media.like_count}
                className="w-full justify-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              />
            </div>

            {/* Share */}
            <EntityModalShareButton mediaId={media.id} entitySlug={entitySlug} />

            {/* Watch this show */}
            {event ? (
              <Link
                href={`/${entitySlug}/${event.slug}`}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-croll/40 bg-croll/10 px-4 py-2 text-sm font-medium text-croll transition hover:bg-croll/20"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch this show
              </Link>
            ) : null}

            <div className="my-4 h-px bg-white/10" />

            {/* More from this show */}
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-gray-600">
              {event
                ? `More from ${event.venue_name}${event.city ? `, ${event.city}` : ''}`
                : 'More from this show'}
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
                        <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded bg-smoke">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-600">▶</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-gray-300">
                            {mSong ?? (m.duration_sec ? formatDuration(m.duration_sec) : m.file_type === 'photo' ? 'Photo' : 'Video')}
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

        {/* X close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute flex items-center justify-center rounded-full text-white transition z-20"
          style={{ top: '12px', right: '12px', width: '36px', height: '36px', background: 'rgba(255,255,255,0.1)' }}
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

function EntityModalShareButton({ mediaId, entitySlug: _entitySlug }: { mediaId: string; entitySlug: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/watch/${mediaId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* blocked */ }
      }}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}

// ── Context ───────────────────────────────────────────────────────────────────

import { createContext, useContext } from 'react';

const EntityModalContext = createContext<(id: string) => void>(() => {});

// ── EntityPageMediaWrapper ────────────────────────────────────────────────────
// Top-level client wrapper that owns modal state and provides openModal via
// context. Wrap the entire page content (below Nav) with this component so both
// the hero grid and the highlights section can share state.

export function EntityPageMediaWrapper({
  allMedia,
  entitySlug,
  eventMap,
  children,
}: {
  allMedia: EntityMediaItem[];
  entitySlug: string;
  eventMap: EntityEventSummary[];
  children: React.ReactNode;
}) {
  const [desktopModalId, setDesktopModalId] = useState<string | null>(null);
  const eventMapObj = new Map(eventMap.map((e) => [e.id, e]));

  useEffect(() => {
    document.body.style.overflow = desktopModalId ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [desktopModalId]);

  const dm = desktopModalId ? allMedia.find((m) => m.id === desktopModalId) ?? null : null;
  const dmIdx = desktopModalId ? allMedia.findIndex((m) => m.id === desktopModalId) : -1;

  return (
    <EntityModalContext.Provider value={(id) => setDesktopModalId(id)}>
      {children}
      {dm ? (
        <EntityDesktopModal
          media={dm}
          allMedia={allMedia}
          mediaList={allMedia}
          currentIdx={dmIdx}
          entitySlug={entitySlug}
          eventMap={eventMapObj}
          onClose={() => setDesktopModalId(null)}
          onNavigate={(id) => setDesktopModalId(id)}
        />
      ) : null}
    </EntityModalContext.Provider>
  );
}

// ── EntityHeroGridWithModal ───────────────────────────────────────────────────
// Drop-in replacement for the server-side HeroGrid that opens the modal.

export function EntityHeroGridWithModal({
  media,
  eventCityMap,
}: {
  media: EntityMediaItem[];
  eventCityMap: [string, string][];
}) {
  const openModal = useContext(EntityModalContext);
  const cityMap = new Map(eventCityMap);
  return <EntityHeroGrid media={media} eventCityMap={cityMap} onItemClick={openModal} />;
}

// ── EntityHighlightsGridWithModal ─────────────────────────────────────────────
// Drop-in replacement for HighlightsGrid in the fan highlights section.

export function EntityHighlightsGridWithModal({
  items,
}: {
  items: EntityMediaItem[];
}) {
  const openModal = useContext(EntityModalContext);
  return <HighlightsGrid items={items} onItemClick={openModal} />;
}
