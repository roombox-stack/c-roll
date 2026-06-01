'use client';

// Admin UI for manually curating the 6-slot hero media grid on an entity page.
//
// Shows a scrollable gallery of all active media for the entity. Click a card
// to add it to the selection (max 6, in order). Click a selected card again to
// remove it. Drag handles let you reorder. Save calls setHeroMediaIds.

import { useState, useTransition } from 'react';
import { setHeroMediaIds } from '../actions';

export interface HeroMediaOption {
  id: string;
  thumbnail_url: string | null;
  storage_url: string;
  file_type: 'photo' | 'video';
  song_tag: string | null;
  event_city: string | null;
  duration_sec: number | null;
}

interface Props {
  entityId: string;
  mediaOptions: HeroMediaOption[];
  initialIds: string[];
}

export function HeroGridPicker({ entityId, mediaOptions, initialIds }: Props) {
  const [selected, setSelected] = useState<string[]>(initialIds.slice(0, 6));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const selectedSet = new Set(selected);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev; // cap at 6
      return [...prev, id];
    });
    setSaved(false);
  }

  function remove(idx: number) {
    setSelected((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  // Drag-to-reorder within the selected strip.
  function onDragStart(idx: number) {
    setDragIdx(idx);
  }

  function onDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setSelected((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await setHeroMediaIds(entityId, selected);
      setSaved(true);
    });
  }

  function clearAll() {
    setSelected([]);
    setSaved(false);
  }

  const optionMap = new Map(mediaOptions.map((m) => [m.id, m]));

  return (
    <div className="space-y-5">
      {/* Selected strip */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Selected ({selected.length}/6)
          </h3>
          <div className="flex gap-2">
            {selected.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {selected.length === 0 ? (
          <div className="rounded border border-dashed border-ash p-4 text-center text-xs text-gray-600">
            No clips pinned — the page will auto-select by view count.
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {selected.map((id, idx) => {
              const m = optionMap.get(id);
              const thumb = m?.thumbnail_url ?? m?.storage_url ?? null;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(idx)}
                  className="group relative cursor-grab active:cursor-grabbing"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded bg-smoke">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-ash text-[10px] text-gray-600">
                        {m?.file_type === 'video' ? '▶' : '📷'}
                      </div>
                    )}
                    {/* Position badge */}
                    <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-[9px] font-bold text-white">
                      {idx + 1}
                    </span>
                    {/* City label */}
                    {m?.event_city ? (
                      <span
                        className="absolute bottom-0 inset-x-0 truncate px-1 pb-0.5 font-mono text-[8px] font-semibold"
                        style={{ color: '#FFCC00' }}
                      >
                        {m.event_city.toUpperCase()}
                      </span>
                    ) : null}
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-black/80 text-[10px] text-white group-hover:flex"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Empty placeholder slots */}
            {Array.from({ length: 6 - selected.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-[4/5] rounded border border-dashed border-ash/40 bg-smoke/30"
              />
            ))}
          </div>
        )}
      </div>

      {/* Save / status */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded border border-emerald-700 bg-emerald-900/30 px-4 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save grid'}
        </button>
        {saved && !pending && (
          <span className="text-xs text-emerald-400">✓ Saved</span>
        )}
        {selected.length === 6 && (
          <span className="text-xs text-amber-400">Grid full (6/6)</span>
        )}
      </div>

      {/* Gallery */}
      <div>
        <p className="mb-2 text-xs text-gray-500">
          Click to add to grid · {mediaOptions.length} clips available
        </p>
        <div className="max-h-[480px] overflow-y-auto rounded-lg border border-ash bg-smoke/30 p-3">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {mediaOptions.map((m) => {
              const isSelected = selectedSet.has(m.id);
              const thumb = m.thumbnail_url ?? (m.file_type === 'photo' ? m.storage_url : null);
              const selIdx = selected.indexOf(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  disabled={!isSelected && selected.length >= 6}
                  className={`group relative aspect-[4/5] overflow-hidden rounded transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-black'
                      : 'hover:ring-2 hover:ring-white/40 hover:ring-offset-1 hover:ring-offset-black'
                  }`}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-ash text-xs text-gray-600">
                      {m.file_type === 'video' ? '▶' : '📷'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                  {/* City */}
                  {m.event_city ? (
                    <span
                      className="absolute bottom-0 inset-x-0 truncate px-1 pb-0.5 text-left font-mono text-[8px] font-semibold"
                      style={{ color: '#FFCC00' }}
                    >
                      {m.event_city.toUpperCase()}
                    </span>
                  ) : null}

                  {/* Video indicator */}
                  {m.file_type === 'video' && (
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[9px] text-white">
                      ▶
                    </span>
                  )}

                  {/* Selected badge */}
                  {isSelected && (
                    <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-black">
                      {selIdx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
