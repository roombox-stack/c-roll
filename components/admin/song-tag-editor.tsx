'use client';

// Inline song-tag editor for a single media row.
//
// Collapsed: shows the current tag (or a muted "—") with a small tag icon
// button. Click the icon to expand into a select+input row. If a setlist is
// provided the user gets a dropdown of those songs plus a free-text fallback;
// otherwise it's a plain text input.
//
// Saving calls the server action setSongTag from app/admin/(shell)/media/actions.

import { useState, useTransition } from 'react';
import { setSongTag } from '@/app/admin/(shell)/media/actions';

export function SongTagEditor({
  mediaId,
  currentTag,
  setlist,
  align = 'left',
}: {
  mediaId: string;
  currentTag: string | null;
  setlist?: string[] | null;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentTag ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setlistOptions = (setlist ?? []).filter(
    (s) => typeof s === 'string' && s.trim() && s.trim().toLowerCase() !== 'play video',
  );
  const hasSetlist = setlistOptions.length > 0;

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setSongTag(mediaId, next);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed');
      }
    });
  }

  if (!open) {
    return (
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {currentTag ? (
          <span className="truncate rounded-full bg-croll/15 px-2 py-0.5 text-[10px] font-medium text-croll">
            {currentTag}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600">no song tag</span>
        )}
        <button
          type="button"
          onClick={() => {
            setValue(currentTag ?? '');
            setOpen(true);
          }}
          aria-label="Edit song tag"
          className="rounded p-1 text-gray-500 transition hover:bg-ash hover:text-white"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {hasSetlist ? (
          <select
            value={setlistOptions.includes(value) ? value : '__custom__'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__custom__') {
                // Keep whatever's in the freetext field
              } else if (v === '__clear__') {
                setValue('');
              } else {
                setValue(v);
              }
            }}
            disabled={pending}
            className="max-w-[160px] rounded border border-ash bg-ink px-2 py-1 text-xs text-white"
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasSetlist ? 'or type custom' : 'Song title'}
          disabled={pending}
          maxLength={120}
          className="min-w-[140px] flex-1 rounded border border-ash bg-ink px-2 py-1 text-xs text-white placeholder:text-gray-600"
        />
        <button
          type="button"
          onClick={() => save(value.trim() || null)}
          disabled={pending}
          className="rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-50"
        >
          {pending ? '…' : 'Save'}
        </button>
        {currentTag ? (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={pending}
            className="rounded border border-red-800 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900/30 disabled:opacity-50"
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setValue(currentTag ?? '');
          }}
          disabled={pending}
          className="rounded border border-ash px-2 py-1 text-[10px] text-gray-400 hover:bg-ash hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
