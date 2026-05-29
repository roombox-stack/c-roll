'use client';

import { hideEntity, unhideEntity, deleteEntity } from '../actions';

export function DangerZone({
  entityId,
  entityName,
  hidden,
}: {
  entityId: string;
  entityName: string;
  hidden: boolean;
}) {
  return (
    <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>

      {/* Hide / unhide */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">
            {hidden ? 'This entity is hidden from the public site.' : 'Hide from public site'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {hidden
              ? 'Re-publish it to make it visible again.'
              : 'The page and all its events stay in the DB — only you can see them.'}
          </p>
        </div>
        {hidden ? (
          <form action={unhideEntity.bind(null, entityId)}>
            <button
              type="submit"
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/20 transition"
            >
              Unhide (re-publish)
            </button>
          </form>
        ) : (
          <form action={hideEntity.bind(null, entityId)}>
            <button
              type="submit"
              className="rounded border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/20 transition"
            >
              Hide entity
            </button>
          </form>
        )}
      </div>

      <hr className="border-red-900/30" />

      {/* Delete */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">Delete entity permanently</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Removes the entity and all associated events from the database. This cannot be undone.
          </p>
        </div>
        <form
          action={deleteEntity.bind(null, entityId)}
          onSubmit={(e) => {
            if (!confirm(`Permanently delete "${entityName}"? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition"
          >
            Delete entity
          </button>
        </form>
      </div>
    </div>
  );
}
