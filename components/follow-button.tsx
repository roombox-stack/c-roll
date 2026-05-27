'use client';

// Toggle-able Follow / Following button for an entity.
//
// Usage: render with the initial follow state + follower count from a server
// component. Click POSTs (or DELETEs) /api/entities/[slug]/follow. Updates
// optimistically and reconciles with the server count on response.
//
// If the user is signed out, the click redirects them to /signin with a
// `next` param so they land back here after auth.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  entitySlug: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  isAuthed: boolean;
  /** Visual variant. */
  variant?: 'hero' | 'pill' | 'ghost';
  /** Optional className overrides for layout. */
  className?: string;
  /** Show "Follow · N" with the running count. Default true. */
  showCount?: boolean;
}

export function FollowButton({
  entitySlug,
  initialFollowing,
  initialFollowerCount,
  isAuthed,
  variant = 'hero',
  className = '',
  showCount = true,
}: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowerCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(e: React.MouseEvent) {
    // Prevent parent <Link> navigation when this button lives inside a card.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    if (!isAuthed) {
      const next = encodeURIComponent(
        typeof window !== 'undefined' ? window.location.pathname : `/${entitySlug}`,
      );
      router.push(`/signin?next=${next}`);
      return;
    }

    const wasFollowing = following;
    // Optimistic flip.
    setFollowing(!wasFollowing);
    setCount((c) => c + (wasFollowing ? -1 : 1));
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/entities/${entitySlug}/follow`, {
          method: wasFollowing ? 'DELETE' : 'POST',
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { following: boolean; followerCount: number };
        setFollowing(json.following);
        setCount(json.followerCount);
      } catch (err) {
        // Roll back the optimistic update.
        setFollowing(wasFollowing);
        setCount((c) => c + (wasFollowing ? 1 : -1));
        setError(err instanceof Error ? err.message : 'failed');
      }
    });
  }

  const label = following ? 'Following' : 'Follow';
  const baseClasses = (() => {
    if (variant === 'hero') {
      return following
        ? 'border border-white/40 bg-white/15 text-white hover:bg-white/20'
        : 'border border-white/20 bg-white/5 text-white hover:bg-white/10';
    }
    if (variant === 'pill') {
      return following
        ? 'border border-croll bg-croll text-ink'
        : 'border border-white/20 bg-white/5 text-white hover:bg-white/10';
    }
    // ghost
    return following
      ? 'border border-white/30 text-white hover:bg-white/5'
      : 'border border-white/15 text-gray-300 hover:border-white/30 hover:text-white';
  })();

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      title={error ?? undefined}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium backdrop-blur transition disabled:opacity-70 ${baseClasses} ${className}`}
    >
      <span>{label}</span>
      {showCount && count > 0 ? (
        <span className={following ? 'text-white/70' : 'text-gray-400'}>
          · {formatCount(count)}
        </span>
      ) : null}
    </button>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}
