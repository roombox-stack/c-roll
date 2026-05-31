'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatCount } from './format';

interface Props {
  username: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  isAuthed: boolean;
}

export function ProfileFollowButton({
  username,
  initialFollowing,
  initialFollowerCount,
  isAuthed,
}: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowerCount);
  const [hovered, setHovered] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    if (pending) return;

    if (!isAuthed) {
      const next = encodeURIComponent(window.location.pathname);
      router.push(`/signin?next=${next}`);
      return;
    }

    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setCount((c) => c + (wasFollowing ? -1 : 1));

    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${username}/follow`, {
          method: wasFollowing ? 'DELETE' : 'POST',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { following: boolean; followerCount: number };
        setFollowing(json.following);
        setCount(json.followerCount);
      } catch {
        setFollowing(wasFollowing);
        setCount((c) => c + (wasFollowing ? 1 : -1));
      }
    });
  }

  const label = following ? (hovered ? 'Unfollow' : 'Following') : 'Follow';

  const cls = following
    ? hovered
      ? 'border border-red-500/60 bg-red-500/15 text-red-300'
      : 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
    : 'border border-white/20 bg-white/5 text-white hover:bg-white/10';

  return (
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={pending}
      aria-pressed={following}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium backdrop-blur transition disabled:opacity-70 ${cls}`}
    >
      <span>{label}</span>
      {count > 0 ? (
        <span className="text-xs opacity-70">· {formatCount(count)}</span>
      ) : null}
    </button>
  );
}
