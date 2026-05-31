'use client';

import { deleteEvent } from '../actions';

export function DangerZone({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  return (
    <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">Delete event permanently</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Removes the event and all its media from the database. This cannot be undone.
          </p>
        </div>
        <form
          action={deleteEvent.bind(null, eventId)}
          onSubmit={(e) => {
            if (!confirm(`Permanently delete "${eventName}"? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition"
          >
            Delete event
          </button>
        </form>
      </div>
    </div>
  );
}
