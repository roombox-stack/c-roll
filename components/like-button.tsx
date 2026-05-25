// Anonymous-session-aware like button.
//
// On click: POST /api/media/[id]/like with sessionToken from localStorage.
// The API decides toggle direction (server-authoritative) and returns the new
// liked state + count. We don't pre-fetch the liked state on mount — for V1
// the user can tap once to see; a `like-status` endpoint can be added later.

'use client';

import { useState, useTransition } from 'react';
import { getOrCreateClientSessionToken } from '@/lib/session';
import { formatCount } from './format';

export function LikeButton({
  mediaId,
  initialLikeCount,
  initialLiked = false,
}: {
  mediaId: string;
  initialLikeCount: number;
  initialLiked?: boolean;
}) {
  const [count, setCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initialLiked);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    startTransition(async () => {
      try {
        const sessionToken = getOrCreateClientSessionToken();
        const resp = await fetch(`/api/media/${mediaId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken }),
        });
        if (!resp.ok) return;
        const json: { liked: boolean; likeCount: number } = await resp.json();
        setCount(json.likeCount);
        setLiked(json.liked);
      } catch {
        // network error — leave state unchanged
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition disabled:opacity-60 ${
        liked
          ? 'bg-red-900/40 text-red-300 hover:bg-red-900/60'
          : 'bg-ink text-white hover:bg-ash'
      }`}
      aria-pressed={liked}
    >
      <span aria-hidden>{liked ? '♥' : '♡'}</span>
      <span className="tabular-nums">{formatCount(count)}</span>
    </button>
  );
}
