'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SigninForm({ next }: { next?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const resp = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(fd.get('email') ?? ''),
          password: String(fd.get('password') ?? ''),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error ?? 'sign-in failed');
        return;
      }
      const dest =
        next && next.startsWith('/') && !next.startsWith('//')
          ? next
          : `/profile/${json.profile?.username ?? 'me'}`;
      router.push(dest);
      router.refresh();
    } catch {
      setError('network error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded border border-ash bg-smoke px-3 py-2 text-white focus:border-gray-500 focus:outline-none';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}
      <label className="block space-y-1">
        <span className="text-sm text-gray-400">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          className={inputCls}
        />
      </label>
      <label className="block space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Password</span>
          <a href="/forgot-password" className="text-xs text-gray-400 underline hover:text-white">
            Forgot password?
          </a>
        </div>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink hover:bg-gray-200 disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
