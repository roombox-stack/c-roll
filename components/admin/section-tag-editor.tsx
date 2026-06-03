'use client';

import { useState, useTransition } from 'react';
import { setSectionTag } from '@/app/admin/(shell)/media/actions';
import type { SectionTag } from '@/lib/types';

const SECTION_OPTIONS: { value: SectionTag; label: string }[] = [
  { value: 'floor', label: 'Floor / Pit' },
  { value: 'section_100', label: 'Lower Bowl' },
  { value: 'upper', label: 'Upper Deck' },
  { value: 'vip', label: 'VIP' },
];

const LABEL: Record<SectionTag, string> = Object.fromEntries(
  SECTION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SectionTag, string>;

export function SectionTagEditor({
  mediaId,
  currentTag,
}: {
  mediaId: string;
  currentTag: SectionTag | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentTag ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setSectionTag(mediaId, next);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed');
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        {currentTag ? (
          <span className="truncate rounded-full bg-violet-900/40 px-2 py-0.5 text-[10px] font-medium text-violet-300">
            {LABEL[currentTag] ?? currentTag}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600">—</span>
        )}
        <button
          type="button"
          onClick={() => {
            setValue(currentTag ?? '');
            setOpen(true);
          }}
          aria-label="Edit section tag"
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
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className="rounded border border-ash bg-ink px-2 py-1 text-xs text-white"
        >
          <option value="">— none —</option>
          {SECTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => save(value || null)}
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
