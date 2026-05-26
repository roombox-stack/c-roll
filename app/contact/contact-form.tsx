'use client';

import { useState, useTransition } from 'react';

type State = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>('idle');
  const [, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'submitting') return;
    setState('submitting');
    startTransition(async () => {
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message }),
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
        <p className="text-lg font-medium text-emerald-300">Message sent</p>
        <p className="mt-2 text-sm text-gray-400">Thanks, {name}. We'll get back to you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-gray-300">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-md border border-ash bg-ink px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-gray-300">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-ash bg-ink px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-gray-300">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full rounded-md border border-ash bg-ink px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
      </div>

      {state === 'error' ? (
        <p className="text-sm text-red-400">Something went wrong — please try again.</p>
      ) : null}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200 disabled:opacity-60"
      >
        {state === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
