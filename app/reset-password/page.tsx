'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Nav } from '@/components/nav';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts the recovery tokens in the URL fragment (#access_token=…&type=recovery).
    // We need the browser client to exchange them into a session before we can call updateUser.
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error ?? 'something went wrong');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/signin'), 2500);
    } catch {
      setError('network error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded border border-ash bg-smoke px-3 py-2 text-white focus:border-gray-500 focus:outline-none';

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Reset password</h1>

        {done ? (
          <div className="mt-6 rounded bg-green-900/40 px-4 py-3 text-sm text-green-300">
            Password updated. Redirecting you to sign in…
          </div>
        ) : !ready ? (
          <p className="mt-6 text-sm text-gray-400">Verifying your reset link…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {error && (
              <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
            )}
            <label className="block space-y-1">
              <span className="text-sm text-gray-400">New password</span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
                className={inputCls}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-gray-400">Confirm password</span>
              <input
                type="password"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink hover:bg-gray-200 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
