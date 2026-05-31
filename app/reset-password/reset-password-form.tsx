'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error params Supabase puts in the hash (e.g. otp_expired)
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const errCode = params.get('error_code');
    if (errCode) {
      const desc = params.get('error_description')?.replace(/\+/g, ' ') ?? 'Invalid or expired reset link.';
      setError(desc);
      return;
    }

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

  if (done) {
    return (
      <div className="rounded bg-green-900/40 px-4 py-3 text-sm text-green-300">
        Password updated. Redirecting you to sign in…
      </div>
    );
  }

  if (!ready && !error) {
    return <p className="text-sm text-gray-400">Verifying your reset link…</p>;
  }

  if (error && !ready) {
    return (
      <div className="space-y-4">
        <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
        <a href="/forgot-password" className="block text-sm text-white underline">
          Request a new reset link
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
  );
}
