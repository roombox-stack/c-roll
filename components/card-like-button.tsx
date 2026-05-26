// Like button designed to live as an absolute overlay on a media card.
//
// NOT nested inside the card's <Link> — it's a sibling so clicks toggle the
// like without navigating to the watch page.
//
// Desktop: invisible until the card is hovered (requires `group` on the card wrapper).
// Mobile: always visible (opacity-100).
//
// Like state starts optimistically at initialLiked=false (we don't pre-fetch per-card
// liked status — same tradeoff as the watch-page LikeButton).

'use client';

import { useState, useTransition } from 'react';
import { getOrCreateClientSessionToken } from '@/lib/session';
import { formatCount } from './format';

interface CardLikeButtonProps {
  mediaId: string;
  initialLikeCount: number;
  initialLiked?: boolean;
  className?: string;
}

export function CardLikeButton({
  mediaId,
  initialLikeCount,
  initialLiked = false,
  className = '',
}: CardLikeButtonProps) {
  const [count, setCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initialLiked);
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    // Stop the click reaching the parent <Link> — we're a sibling, not a child,
    // but stopPropagation is still good practice for nested stacking contexts.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    startTransition(async () => {
      // Optimistic toggle so the UI responds instantly.
      const nextLiked = !liked;
      setLiked(nextLiked);
      setCount((c) => (nextLiked ? c + 1 : Math.max(c - 1, 0)));
      try {
        const sessionToken = getOrCreateClientSessionToken();
        const res = await fetch(`/api/media/${mediaId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken }),
        });
        if (!res.ok) {
          // Revert on failure.
          setLiked(liked);
          setCount(initialLikeCount);
          return;
        }
        const json: { liked: boolean; likeCount: number } = await res.json();
        setLiked(json.liked);
        setCount(json.likeCount);
      } catch {
        setLiked(liked);
        setCount(initialLikeCount);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={liked ? 'Unlike' : 'Like'}
      aria-pressed={liked}
      disabled={pending}
      className={`
        inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium
        backdrop-blur transition-all duration-150
        disabled:cursor-not-allowed
        ${liked
          ? 'bg-red-600/80 text-white hover:bg-red-600'
          : 'bg-black/60 text-white hover:bg-black/80'
        }
        opacity-100 md:opacity-0 md:group-hover:opacity-100
        ${className}
      `}
    >
      {liked ? (
        /* filled heart */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ) : (
        /* outline heart */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )}
      <span className="tabular-nums">{formatCount(count)}</span>
    </button>
  );
}
