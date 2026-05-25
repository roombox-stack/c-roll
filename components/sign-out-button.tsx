'use client';

// Tiny client button — POSTs /api/auth/signout then hard-refreshes the page.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-md border border-ash bg-smoke px-3 py-1.5 text-sm text-gray-300 hover:bg-ash disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
