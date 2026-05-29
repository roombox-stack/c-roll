'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const INPUT_CLS =
  'rounded border border-ash bg-ink px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none';

export function EventsFilter({
  entities,
}: {
  entities: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const entity = params.get('entity') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `/admin/events?${qs}` : '/admin/events');
    },
    [params, router],
  );

  const hasFilters = entity || from || to;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="block text-xs uppercase text-gray-400">Entity</span>
        <select
          value={entity}
          onChange={(e) => update('entity', e.target.value)}
          className={INPUT_CLS}
        >
          <option value="">All entities</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              {ent.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="block text-xs uppercase text-gray-400">From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => update('from', e.target.value)}
          className={INPUT_CLS}
        />
      </label>

      <label className="space-y-1">
        <span className="block text-xs uppercase text-gray-400">To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => update('to', e.target.value)}
          className={INPUT_CLS}
        />
      </label>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => router.replace('/admin/events')}
          className="rounded border border-ash px-3 py-2 text-sm text-gray-400 hover:text-white"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
