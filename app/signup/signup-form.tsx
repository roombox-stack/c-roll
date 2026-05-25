'use client';

// Signup form: email + username + display name + password. Submits to
// /api/auth/signup. If ?attend=<eventId> is set, also calls
// /api/attendance/toggle so anonymous "I Was There" intents survive signup.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SignupForm({
  next,
  attendEventId,
}: {
  next?: string;
  attendEventId?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(fd.get('email') ?? ''),
          password: String(fd.get('password') ?? ''),
          username: String(fd.get('username') ?? ''),
          display_name: String(fd.get('display_name') ?? ''),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error ?? 'sign-up failed');
        return;
      }

      // If we got here from "I Was There", toggle attendance now that we're authed.
      if (attendEventId) {
        await fetch('/api/attendance/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: attendEventId }),
        });
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field
        label="Username"
        name="username"
        required
        autoComplete="username"
        placeholder="3–30 chars, a–z 0–9 _"
      />
      <Field label="Display name" name="display_name" placeholder="Optional" />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        minLength={8}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink hover:bg-gray-200 disabled:opacity-60"
      >
        {submitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-400">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        className="w-full rounded border border-ash bg-smoke px-3 py-2 text-white focus:border-gray-500 focus:outline-none"
      />
    </label>
  );
}
