'use client';

import { useState, useTransition } from 'react';
import { setHeroImage } from '../actions';

interface MediaOption {
  id: string;
  url: string;
  thumbnail_url: string | null;
}

interface HeroPickerClientProps {
  entityId: string;
  currentHeroUrl: string | null;
  mediaOptions: MediaOption[];
}

export function HeroPickerClient({ entityId, currentHeroUrl, mediaOptions }: HeroPickerClientProps) {
  const [selected, setSelected] = useState<string | null>(currentHeroUrl);
  const [customUrl, setCustomUrl] = useState('');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(url: string | null) {
    startTransition(async () => {
      await setHeroImage(entityId, url);
      setSelected(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function handleCustomUrl() {
    const url = customUrl.trim();
    if (!url) return;
    save(url);
  }

  return (
    <div className="space-y-4">
      {/* Current hero preview */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Current hero image
        </p>
        {selected ? (
          <div className="relative h-36 w-full overflow-hidden rounded-lg border border-ash">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <button
              onClick={() => save(null)}
              disabled={isPending}
              className="absolute right-2 top-2 rounded border border-red-700 bg-black/70 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900/50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-ash text-sm text-gray-500">
            No hero image set
          </div>
        )}
      </div>

      {/* Saved feedback */}
      {saved && (
        <p className="text-xs font-medium text-emerald-400">✓ Hero image saved</p>
      )}

      {/* Media grid */}
      {mediaOptions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Pick from uploaded photos ({mediaOptions.length})
          </p>
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-ash p-2">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {mediaOptions.map((m) => {
                const thumb = m.thumbnail_url ?? m.url;
                const isActive = selected === m.url || selected === m.thumbnail_url;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => save(m.url)}
                    disabled={isPending}
                    className={`group relative aspect-square overflow-hidden rounded border-2 transition ${
                      isActive
                        ? 'border-croll ring-1 ring-croll/50'
                        : 'border-ash hover:border-gray-500'
                    } disabled:opacity-50`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-lg text-croll">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mediaOptions.length === 0 && (
        <p className="text-xs text-gray-500">
          No uploaded photos found for this entity. Upload photos via the entity's event pages first.
        </p>
      )}

      {/* Custom URL fallback */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Or paste an external URL
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 rounded border border-ash bg-ink px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCustomUrl}
            disabled={isPending || !customUrl.trim()}
            className="rounded border border-ash px-3 py-1.5 text-sm text-gray-300 hover:bg-ash disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </div>
    </div>
  );
}
