'use client';

// Transient "Changes saved" confirmation for admin edit forms.
//
// Server actions redirect back to the edit page with ?saved=<timestamp> on
// success. This reads that token and shows a toast that auto-dismisses after a
// few seconds. Because the token changes on every save, re-saving re-triggers
// the effect and the toast reappears.

import { useEffect, useState } from 'react';

export function SavedToast({ token }: { token?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!token) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, [token]);

  if (!token || !show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 shadow-lg backdrop-blur"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-1.2 14.6L6.6 12.4l1.4-1.4 2.8 2.8 5.6-5.6 1.4 1.4-7 7z" />
      </svg>
      Changes saved
    </div>
  );
}
