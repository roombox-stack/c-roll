// Sticky top navigation.
//
// Layout per design: SHOWSIDE wordmark · topic nav (Discover / Music / Sports
// / Racing) · search icon · outlined Upload button · profile avatar (when
// signed in). No inline search bar — the /search page is one click away.
//
// This is an async server component so it can read the Supabase session and
// show the right CTA (avatar or "Sign in" link).

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const TOPIC_NAV: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Discover' },
  { href: '/?type=artist', label: 'Music' },
  { href: '/?type=team', label: 'Sports' },
  { href: '/?type=event_brand', label: 'Racing' },
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
  // username + display_name are written into user_metadata by /api/auth/signup.
  // Reading them here avoids a second DB round-trip per page.
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
    <header className="sticky top-0 z-40 border-b border-ash/60 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <Link href="/" className="text-base font-bold tracking-[0.18em] text-white">
          SHOWSIDE
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {TOPIC_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded px-3 py-1.5 text-sm text-gray-300 transition hover:bg-ash hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="rounded p-2 text-gray-300 hover:bg-ash hover:text-white"
          >
            <svg
              width="18"
              height="18"
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

          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-md border border-ash bg-smoke px-3 py-1.5 text-sm font-medium text-white hover:bg-ash"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
            Upload
          </Link>

          {session ? (
            <Link
              href={`/profile/${session.username}`}
              title={
                session.displayName
                  ? `${session.displayName} (@${session.username})`
                  : `@${session.username}`
              }
              aria-label="My profile"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ash bg-smoke text-xs font-semibold text-gray-200 transition hover:bg-ash hover:text-white"
            >
              {initialsFor(session.displayName ?? session.username)}
            </Link>
          ) : (
            <Link
              href="/signin"
              className="hidden rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-ash hover:text-white sm:inline-block"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
