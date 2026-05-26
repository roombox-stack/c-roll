// Fire-and-forget view ping. Mount this in the full-screen viewer; the API
// dedupes per (media, session) so re-renders won't double-count.

'use client';

import { useEffect } from 'react';
import { getOrCreateClientSessionToken } from '@/lib/session';

export function ViewPing({ mediaId }: { mediaId: string }) {
  useEffect(() => {
    let cancelled = false;
    try {
      const sessionToken = getOrCreateClientSessionToken();
      fetch('/api/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId, sessionToken }),
        keepalive: true,
      }).catch(() => {
        // network error — silently ignore
      });
    } catch {
      // localStorage unavailable (SSR/private mode) — skip
    }
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [mediaId]);

  return null;
}
