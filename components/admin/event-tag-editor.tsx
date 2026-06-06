'use client';

// Inline event editor for a single media row in the admin media table.
//
// Collapsed: shows the current event name (truncated) + edit icon.
// Expanded: fetches all events for the media's entity, shows a searchable
// select + clear button. Saving calls the setMediaEvent server action.

import { useState, useTransition, useEffect } from 'react';
import { setMediaEvent } from '@/app/admin/(shell)/media/actions';

interface EventOption {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
}

export function EventTagEditor({
  mediaId,
  entityId,
  currentEventId,
  currentEventName,
}: {
  mediaId: string;
  entityId: string;
  currentEventId: string | null;
  currentEventName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState<string>(currentEventId ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Fetch events for this entity when the editor opens.
  useEffect(() => {
    if (!open || events.length > 0) return;
    setLoading(true);
    fetch(`/api/admin/events-for-entity?entityId=${entityId}`)
      .then((r) => r.json())
      .then((data: EventOption[]) => {
        setEvents(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, entityId, events.length]);

  function save(nextId: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setMediaEvent(mediaId, nextId);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed');
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        {currentEventName ? (
          <span className="truncate text-[11px] text-white" title={currentEventName}>
            {currentEventName}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600">—</span>
        )}
        <button
          type="button"
          onClick={() => { setValue(currentEventId ?? ''); setOpen(true); }}
          aria-label="Edit event"
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
        {loading ? (
          <span className="text-[10px] text-gray-500">Loading…</span>
        ) : (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            className="max-w-[220px] rounded border border-ash bg-ink px-2 py-1 text-xs text-white"
          >
            <option value="">— none —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}{ev.city ? ` — ${ev.city}` : ''}{ev.event_date ? ` (${ev.event_date.slice(0, 10)})` : ''}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => save(value || null)}
          disabled={pending || loading}
          className="rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-50"
        >
          {pending ? '…' : 'Save'}
        </button>
        {currentEventId && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={pending}
            className="rounded border border-red-800 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900/30 disabled:opacity-50"
          >
            Remove
          </button>
        )}
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
