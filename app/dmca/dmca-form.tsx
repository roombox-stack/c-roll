'use client';

import { useState, useTransition } from 'react';

type State = 'idle' | 'submitting' | 'success' | 'error';

export function DmcaForm() {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'submitting') return;
    setState('submitting');
    startTransition(async () => {
      try {
        const res = await fetch('/api/dmca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, description, contactEmail }),
        });
        setState(res.ok ? 'success' : 'error');
      } catch {
        setState('error');
      }
    });
  }

  if (state === 'success') {
    return (
      <div className="rounded-lg bg-emerald-900/30 px-5 py-6 text-center">
        <p className="text-lg font-medium text-emerald-300">Request received</p>
        <p className="mt-2 text-sm text-gray-400">
          We'll review your notice and respond to {contactEmail} within 5 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="dmca-url" className="mb-1.5 block text-sm font-medium text-gray-300">
          URL of infringing content
        </label>
        <input
          id="dmca-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://showside.app/watch/..."
          className="w-full rounded-md border border-ash bg-ink px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="dmca-desc" className="mb-1.5 block text-sm font-medium text-gray-300">
          Description of your copyrighted work
        </label>
        <textarea
          id="dmca-desc"
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the original work and how the content above infringes it..."
          className="w-full rounded-md border border-ash bg-ink px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="dmca-email" className="mb-1.5 block text-sm font-medium text-gray-300">
          Contact email
        </label>
        <input
          id="dmca-email"
          type="email"
          required
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-ash bg-ink px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
      </div>

      <p className="text-xs text-gray-500">
        By submitting, you represent under penalty of perjury that the information is accurate
        and that you are authorized to act on behalf of the copyright owner.
      </p>

      {state === 'error' ? (
        <p className="text-sm text-red-400">Something went wrong — please try again.</p>
      ) : null}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200 disabled:opacity-60"
      >
        {state === 'submitting' ? 'Submitting…' : 'Submit takedown request'}
      </button>
    </form>
  );
}
