'use client';

import { useState } from 'react';
import { Nav } from '@/components/nav';

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const resp = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(fd.get('email') ?? '') }),
      });
      if (!resp.ok) {
        const json = await resp.json();
        setError(json.error ?? 'something went wrong');
        return;
      }
      setSent(true);
    } catch {
      setError('network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-gray-400">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded bg-green-900/40 px-4 py-3 text-sm text-green-300">
            Check your inbox — a reset link is on its way.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {error && (
              <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
            )}
            <label className="block space-y-1">
              <span className="text-sm text-gray-400">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                autoFocus
                className="w-full rounded border border-ash bg-smoke px-3 py-2 text-white focus:border-gray-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink hover:bg-gray-200 disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-gray-400">
          Remember it?{' '}
          <a href="/signin" className="text-white underline">
            Sign in
          </a>
        </p>
      </main>
    </div>
  );
}
