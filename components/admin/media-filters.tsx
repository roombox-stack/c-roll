'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

interface Entity {
  id: string;
  slug: string;
  name: string;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
  city: string;
}

interface Props {
  entities: Entity[];
  initialEntityId: string;
  initialEventId: string;
}

export function AdminMediaFilters({ entities, initialEntityId, initialEventId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [entityId, setEntityId] = useState(initialEntityId);
  const [eventId, setEventId] = useState(initialEventId);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, startLoadingEvents] = useTransition();

  // Load events whenever entity changes.
  useEffect(() => {
    if (!entityId) {
      setEvents([]);
      return;
    }
    startLoadingEvents(async () => {
      const res = await fetch(`/api/admin/events-for-entity?entityId=${entityId}`);
      if (res.ok) {
        const data = (await res.json()) as Event[];
        setEvents(data);
      }
    });
  }, [entityId]);

  function buildHref(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    // Reset page when filters change.
    params.delete('page');
    return `/admin/media?${params.toString()}`;
  }

  function onEntityChange(id: string) {
    setEntityId(id);
    setEventId('');
    router.push(buildHref({ entity: id, event: '' }));
  }

  function onEventChange(id: string) {
    setEventId(id);
    router.push(buildHref({ event: id }));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Entity picker */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-gray-500">Entity</label>
        <select
          value={entityId}
          onChange={(e) => onEntityChange(e.target.value)}
          className="rounded border border-ash bg-smoke px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
        >
          <option value="">All entities</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event picker — only shown when an entity is selected */}
      {entityId ? (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Event</label>
          <select
            value={eventId}
            disabled={loadingEvents}
            onChange={(e) => onEventChange(e.target.value)}
            className="rounded border border-ash bg-smoke px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
          >
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {new Date(ev.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                — {ev.city}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Clear link */}
      {(entityId || eventId) ? (
        <button
          type="button"
          onClick={() => {
            setEntityId('');
            setEventId('');
            setEvents([]);
            router.push(buildHref({ entity: '', event: '' }));
          }}
          className="mt-5 text-xs text-gray-500 hover:text-white"
        >
          Clear filters ×
        </button>
      ) : null}
    </div>
  );
}
