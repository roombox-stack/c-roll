'use client';

// Per-event bulk song tagger. Renders one row per media item with a setlist
// dropdown + free-text input. Tracks pending changes locally and submits
// only the rows that actually changed via bulkSetSongTags().

import { useMemo, useState, useTransition } from 'react';
import { bulkSetSongTags } from '@/app/admin/(shell)/media/actions';

export interface TaggableMedia {
  id: string;
  file_type: 'photo' | 'video';
  thumbnail_url: string | null;
  storage_url: string;
  song_tag: string | null;
  created_at: string;
}

export function BulkSongTagger({
  media,
  setlist,
}: {
  media: TaggableMedia[];
  setlist: string[];
}) {
  const setlistOptions = useMemo(
    () =>
      (setlist ?? []).filter(
        (s) => typeof s === 'string' && s.trim() && s.trim().toLowerCase() !== 'play video',
      ),
    [setlist],
  );

  // Map<mediaId, currentValue> — initialized to the saved value, mutated by edits.
  const [values, setValues] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const item of media) m.set(item.id, item.song_tag ?? '');
    return m;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = useMemo(() => {
    const out: Array<{ id: string; song_tag: string | null }> = [];
    for (const item of media) {
      const next = (values.get(item.id) ?? '').trim();
      const prev = item.song_tag ?? '';
      if (next !== prev) out.push({ id: item.id, song_tag: next || null });
    }
    return out;
  }, [media, values]);

  function setValueFor(id: string, v: string) {
    setValues((prev) => {
      const next = new Map(prev);
      next.set(id, v);
      return next;
    });
  }

  function saveAll() {
    if (dirty.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkSetSongTags(dirty);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed');
      }
    });
  }

  if (media.length === 0) {
    return (
      <p className="rounded-lg border border-ash bg-smoke p-4 text-sm text-gray-400">
        No media uploaded for this event yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {media.length} item{media.length === 1 ? '' : 's'} ·{' '}
          <span className={dirty.length > 0 ? 'text-amber-400' : 'text-gray-600'}>
            {dirty.length} unsaved
          </span>
          {savedAt && dirty.length === 0 ? (
            <span className="ml-2 text-emerald-400">Saved.</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={saveAll}
          disabled={pending || dirty.length === 0}
          className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Saving…' : `Save all${dirty.length > 0 ? ` (${dirty.length})` : ''}`}
        </button>
      </div>

      {error ? (
        <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-ash overflow-hidden rounded-lg border border-ash bg-smoke">
        {media.map((m) => {
          const thumb = m.thumbnail_url ?? (m.file_type === 'photo' ? m.storage_url : null);
          const v = values.get(m.id) ?? '';
          const original = m.song_tag ?? '';
          const isDirty = v.trim() !== original;
          const inSetlist = setlistOptions.includes(v);
          return (
            <li key={m.id} className="flex items-center gap-3 p-2.5">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-ash text-[10px] text-gray-500">
                  {m.file_type}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {setlistOptions.length > 0 ? (
                    <select
                      value={inSetlist ? v : v ? '__custom__' : '__clear__'}
                      onChange={(e) => {
                        const sel = e.target.value;
                        if (sel === '__clear__') setValueFor(m.id, '');
                        else if (sel === '__custom__') {
                          /* keep current freetext */
                        } else setValueFor(m.id, sel);
                      }}
                      disabled={pending}
                      className="max-w-[180px] rounded border border-ash bg-ink px-2 py-1 text-xs text-white"
                    >
                      <option value="__clear__">— none —</option>
                      {setlistOptions.map((s, i) => (
                        <option key={s + i} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__custom__">Custom…</option>
                    </select>
                  ) : null}
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => setValueFor(m.id, e.target.value)}
                    placeholder={setlistOptions.length > 0 ? 'or type custom' : 'Song title'}
                    disabled={pending}
                    maxLength={120}
                    className="min-w-[160px] flex-1 rounded border border-ash bg-ink px-2 py-1 text-xs text-white placeholder:text-gray-600"
                  />
                  {isDirty ? (
                    <span className="text-[10px] text-amber-400">●</span>
                  ) : original ? (
                    <span className="text-[10px] text-emerald-500">✓</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] text-gray-600">
                  {m.file_type} · {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
