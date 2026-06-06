'use client';

import { useState, useTransition } from 'react';
import { setMediaEntity } from '@/app/admin/(shell)/media/actions';

export interface EntityOption {
  id: string;
  name: string;
  slug: string;
}

export function EntityTagEditor({
  mediaId,
  currentEntityId,
  currentEntityName,
  entities,
}: {
  mediaId: string;
  currentEntityId: string | null;
  currentEntityName: string | null;
  entities: EntityOption[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentEntityId ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!value) return;
    setError(null);
    startTransition(async () => {
      try {
        await setMediaEntity(mediaId, value);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed');
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        {currentEntityName ? (
          <span className="truncate text-xs text-gray-400" title={currentEntityName}>
            {currentEntityName}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600">—</span>
        )}
        <button
          type="button"
          onClick={() => { setValue(currentEntityId ?? ''); setOpen(true); }}
          aria-label="Edit entity"
          className="shrink-0 rounded p-1 text-gray-500 transition hover:bg-ash hover:text-white"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
          className="max-w-[180px] rounded border border-ash bg-ink px-2 py-1 text-xs text-white"
        >
          <option value="">— select entity —</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={pending || !value}
          className="rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-50"
        >
          {pending ? '…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={pending}
          className="rounded border border-ash px-2 py-1 text-[10px] text-gray-400 hover:bg-ash hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
