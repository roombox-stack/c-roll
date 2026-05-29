'use client';

// "I was there" attendance toggle.
// - Authenticated: POSTs /api/attendance/toggle, updates local state.
// - Anonymous: navigates to /signup?next=<event-url>&attend=<eventId>; the
//   signup form picks up `?attend` and runs the toggle right after signup.

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatCount } from './format';

export function AttendanceButton({
  eventId,
  eventUrl,
  initiallyAttending,
  initialCount,
  isAuthed,
  fullWidth = false,
}: {
  eventId: string;
  eventUrl: string;
  initiallyAttending: boolean;
  initialCount: number;
  isAuthed: boolean;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [attending, setAttending] = useState(initiallyAttending);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!isAuthed) {
      const params = new URLSearchParams({ next: eventUrl, attend: eventId });
      router.push(`/signup?${params.toString()}`);
      return;
    }
    startTransition(async () => {
      const resp = await fetch('/api/attendance/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (!resp.ok) return;
      const json: { attending: boolean; count: number } = await resp.json();
      setAttending(json.attending);
      setCount(json.count);
    });
  }

  if (fullWidth) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition disabled:opacity-60 ${
            attending
              ? 'border-emerald-700/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20'
              : 'border-white/20 bg-transparent text-white hover:bg-white/5'
          }`}
          aria-pressed={attending}
        >
          {attending ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
              I was there
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              I was there
            </>
          )}
        </button>
        <p className="text-center text-xs text-gray-500">
          {formatCount(count)} {count === 1 ? 'fan was' : 'fans were'} here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
          attending
            ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-700/60 hover:bg-emerald-500/20'
            : 'bg-white text-ink hover:bg-gray-200'
        }`}
        aria-pressed={attending}
      >
        {attending ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            I was there
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            I was there
          </>
        )}
      </button>
      <span className="text-sm text-gray-400">
        {formatCount(count)} {count === 1 ? 'fan was' : 'fans were'} here
      </span>
    </div>
  );
}
