'use client';

import { useState } from 'react';

const INPUT_CLS =
  'w-full rounded border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-gray-600 focus:border-white/40 focus:outline-none transition';
const LABEL_CLS = 'block space-y-2';
const LABEL_TEXT_CLS = 'block text-sm text-gray-400';

const ROLE_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'manager', label: 'Manager' },
  { value: 'label', label: 'Label' },
  { value: 'publicist', label: 'Publicist' },
  { value: 'other', label: 'Other' },
];

const TYPE_OPTIONS = [
  { value: 'music', label: 'Music Artist' },
  { value: 'sports', label: 'Sports Team' },
  { value: 'event_brand', label: 'Event Brand' },
  { value: 'venue', label: 'Venue' },
];

export function ClaimForm({
  defaultName,
  defaultType,
}: {
  defaultName: string;
  defaultType: string;
}) {
  const validType = TYPE_OPTIONS.some((t) => t.value === defaultType) ? defaultType : 'music';

  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [entityType, setEntityType] = useState(validType);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/claim-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, social_handle: socialHandle, entity_type: entityType, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setSuccessEmail(email);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (successEmail) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-croll/15">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFCC00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="font-heading text-xl font-bold text-white">We got it.</h2>
        <p className="mt-2 text-sm text-gray-400">
          We&apos;ll review your request and reach out to{' '}
          <span className="text-white">{successEmail}</span> within a few days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Who is this page for? *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Artist or entity name"
          className={INPUT_CLS}
          autoFocus={!defaultName}
        />
      </label>

      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>How do we reach you? *</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="your@email.com"
          className={INPUT_CLS}
        />
      </label>

      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Your role *</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          className={`${INPUT_CLS} cursor-pointer`}
        >
          <option value="" disabled>Select your role…</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>
          Instagram or Twitter handle{' '}
          <span className="text-gray-600">(so we can verify)</span>
        </span>
        <input
          type="text"
          value={socialHandle}
          onChange={(e) => setSocialHandle(e.target.value)}
          placeholder="@handle"
          className={INPUT_CLS}
        />
      </label>

      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Page type</span>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className={`${INPUT_CLS} cursor-pointer`}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>
          Anything else you want us to know?{' '}
          <span className="text-gray-600">({message.length}/500)</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="Tell us about yourself, your tour schedule, anything that helps…"
          className={`${INPUT_CLS} resize-none`}
        />
      </label>

      {error ? (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-croll px-6 py-3 font-heading font-bold text-ink transition hover:bg-yellow-300 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Request my page'}
      </button>
    </form>
  );
}
