'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const MAX_BIO = 160;
const MAX_DISPLAY_NAME = 80;

export function ProfileEditForm({
  initialDisplayName,
  initialBio,
  username,
}: {
  initialDisplayName: string;
  initialBio: string;
  username: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const bioCharsLeft = MAX_BIO - bio.length;
  const dirty =
    displayName.trim() !== initialDisplayName.trim() ||
    bio.trim() !== initialBio.trim();

  function cancel() {
    router.push(`/profile/${username}`);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || isPending) return;
    setError('');

    if (displayName.trim().length > MAX_DISPLAY_NAME) {
      setError(`Display name must be ${MAX_DISPLAY_NAME} characters or fewer.`);
      return;
    }
    if (bio.trim().length > MAX_BIO) {
      setError(`Bio must be ${MAX_BIO} characters or fewer.`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim() }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError((json as { error?: string }).error ?? 'Save failed.');
          return;
        }
        router.push(`/profile/${username}`);
        router.refresh();
      } catch {
        setError('Network error — please try again.');
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Display name */}
      <div>
        <label htmlFor="edit-display-name" className="mb-1.5 block text-sm font-medium text-gray-300">
          Display name
        </label>
        <input
          id="edit-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={MAX_DISPLAY_NAME}
          placeholder={username}
          className="w-full rounded-md border border-ash bg-smoke px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-gray-600">
          {displayName.length}/{MAX_DISPLAY_NAME}
        </p>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="edit-bio" className="mb-1.5 block text-sm font-medium text-gray-300">
          Bio
        </label>
        <textarea
          id="edit-bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={MAX_BIO}
          placeholder="Tell people about yourself…"
          className="w-full resize-none rounded-md border border-ash bg-smoke px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
        <p
          className={`mt-1 text-right text-xs ${
            bioCharsLeft < 20 ? 'text-amber-400' : 'text-gray-600'
          }`}
        >
          {bioCharsLeft} left
        </p>
      </div>

      {error ? (
        <p className="rounded-md bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={cancel}
          className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!dirty || isPending}
          className="rounded-md bg-white px-5 py-2 text-sm font-semibold text-ink transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
