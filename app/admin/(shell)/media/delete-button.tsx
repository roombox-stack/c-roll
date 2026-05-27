'use client';

import { hardDeleteMedia } from './actions';

export function HardDeleteButton({ id }: { id: string }) {
  return (
    <form
      action={hardDeleteMedia.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm('Permanently delete this row? This cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="w-full rounded border border-red-800 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900/40"
      >
        Delete
      </button>
    </form>
  );
}
