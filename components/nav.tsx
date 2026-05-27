// Sticky top navigation — c-roll design.
//
// Left: c-roll wordmark · Center: topic nav · Right: search icon, Upload (orange), avatar

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const TOPIC_NAV: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Browse' },
  { href: '/?type=artist', label: 'Artists' },
  { href: '/?type=team', label: 'Sports' },
  { href: '/?type=event_brand', label: 'Events' },
];

interface SessionView {
  username: string;
  displayName: string | null;
}

async function getSessionView(): Promise<SessionView | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const metadata = (user.user_metadata ?? {}) as {
    username?: unknown;
    display_name?: unknown;
  };
  const username =
    typeof metadata.username === 'string' && metadata.username.trim()
      ? metadata.username
      : null;
  if (!username) return null;
  const displayName =
    typeof metadata.display_name === 'string' && metadata.display_name.trim()
      ? metadata.display_name
      : null;
  return { username, displayName };
}

function initialsFor(s: string): string {
  return (
    s
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export async function Nav() {
  const session = await getSessionView();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Wordmark */}
        <Link href="/" className="shrink-0 font-display text-lg font-black tracking-tight text-white">
          c<span className="text-croll">·</span>roll
        </Link>

        {/* Center nav */}
        <nav className="ml-4 hidden items-center gap-0.5 md:flex">
          {TOPIC_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Search icon */}
          <Link
            href="/search"
            aria-label="Search"
            className="rounded-md p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </Link>

          {/* Upload — red fill */}
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 rounded-md bg-croll px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-croll/90"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
            Upload
          </Link>

          {/* Avatar or sign in */}
          {session ? (
            <Link
              href={`/profile/${session.username}`}
              title={
                session.displayName
                  ? `${session.displayName} (@${session.username})`
                  : `@${session.username}`
              }
              aria-label="My profile"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
            >
              {initialsFor(session.displayName ?? session.username)}
            </Link>
          ) : (
            <Link
              href="/signin"
              className="hidden rounded-md px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white sm:inline-block"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
