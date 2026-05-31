'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { formatCount } from './format';

interface UserEntry {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  isFollowing: boolean;
  isCurrentUser: boolean;
}

interface Props {
  username: string;
  followerCount: number;
  followingCount: number;
  isAuthed: boolean;
}

export function FollowListModal({ username, followerCount, followingCount, isAuthed }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<UserEntry[] | null>(null);
  const [followingList, setFollowingList] = useState<UserEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (type: 'followers' | 'following') => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${username}/${type}`);
        if (!res.ok) return;
        const data = (await res.json()) as UserEntry[];
        if (type === 'followers') setFollowers(data);
        else setFollowingList(data);
      } finally {
        setLoading(false);
      }
    },
    [username],
  );

  function openTab(t: 'followers' | 'following') {
    setTab(t);
    setOpen(true);
    const current = t === 'followers' ? followers : followingList;
    if (!current) load(t);
  }

  function switchTab(t: 'followers' | 'following') {
    setTab(t);
    const current = t === 'followers' ? followers : followingList;
    if (!current) load(t);
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const list = tab === 'followers' ? followers : followingList;

  return (
    <>
      {/* Trigger stats */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => openTab('followers')}
          className="text-center transition hover:opacity-80"
        >
          <div className="text-lg font-semibold tabular-nums">{formatCount(followerCount)}</div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Followers</div>
        </button>
        <button
          type="button"
          onClick={() => openTab('following')}
          className="text-center transition hover:opacity-80"
        >
          <div className="text-lg font-semibold tabular-nums">{formatCount(followingCount)}</div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Following</div>
        </button>
      </div>

      {/* Modal backdrop */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel — sheet on mobile, modal on desktop */}
          <div className="relative z-10 flex w-full flex-col rounded-t-2xl bg-[#111] shadow-2xl sm:max-w-md sm:rounded-2xl">
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => switchTab('followers')}
                  className={`text-sm font-medium transition ${
                    tab === 'followers' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {formatCount(followerCount)} Followers
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('following')}
                  className={`text-sm font-medium transition ${
                    tab === 'following' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {formatCount(followingCount)} Following
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-500 hover:text-white"
                aria-label="Close"
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
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="h-px bg-white/10" />

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
              {loading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : list === null ? null : list.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {list.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      isAuthed={isAuthed}
                      onClose={() => setOpen(false)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function UserRow({
  user,
  isAuthed,
  onClose,
}: {
  user: UserEntry;
  isAuthed: boolean;
  onClose: () => void;
}) {
  const [following, setFollowing] = useState(user.isFollowing);
  const [pending, startTransition] = useTransition();
  const displayName = user.display_name ?? user.username;
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function toggle() {
    if (!isAuthed || user.isCurrentUser || pending) return;
    const was = following;
    setFollowing(!was);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${user.username}/follow`, {
          method: was ? 'DELETE' : 'POST',
        });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { following: boolean };
        setFollowing(json.following);
      } catch {
        setFollowing(was);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
      <Link href={`/profile/${user.username}`} onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt={displayName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span>{initials || '?'}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{displayName}</div>
          <div className="truncate text-xs text-gray-500">@{user.username}</div>
        </div>
      </Link>
      {!user.isCurrentUser && isAuthed ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`shrink-0 rounded px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
            following
              ? 'border border-white/20 text-gray-300 hover:border-red-500/40 hover:text-red-300'
              : 'border border-white/20 text-gray-300 hover:bg-white/10'
          }`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      ) : null}
    </li>
  );
}
