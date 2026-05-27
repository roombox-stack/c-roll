'use client';

// Phase-5 upload flow — a single client component with a 4-step state
// machine (pick → files → tag → upload → done).
//
// Stays under the 60-second target by:
//   • All step transitions stay on this page (no full navs).
//   • Step 1 is skippable when arriving with a preselected event.
//   • Step 3 (tagging) defaults to a one-tap pill or Skip.
//   • Step 4 fires every presign + upload + complete in parallel via XHR.
//
// Uses the existing API surface verbatim:
//   GET  /api/search
//   POST /api/upload/photo-url
//   POST /api/upload/video-url
//   POST /api/upload/complete
//   POST /api/event-suggestions
//
// All uploads are anonymous — the session token comes from localStorage.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOrCreateClientSessionToken } from '@/lib/session';
import { UPLOAD_SECTION_OPTIONS, SECTION_LABELS, type SectionTag } from '@/lib/types';
import { formatCount } from '@/components/format';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EventOption {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state?: string | null;
  event_date: string;
  entity: { slug: string; name: string };
}

type Step = 'pick' | 'files' | 'tag' | 'upload' | 'done';

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  uploadedBytes: number;
  mediaId?: string;
  error?: string;
}

// ── Limits ───────────────────────────────────────────────────────────────────

const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_PHOTO_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// ── Public component ─────────────────────────────────────────────────────────

export function UploadFlow({ initialEvent }: { initialEvent: EventOption | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialEvent ? 'files' : 'pick');
  const [event, setEvent] = useState<EventOption | null>(initialEvent);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [sectionTag, setSectionTag] = useState<SectionTag | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Revoke object URLs when files are removed or the component unmounts.
  useEffect(() => {
    return () => {
      for (const f of files) URL.revokeObjectURL(f.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming);
    const totalAfter = files.length + list.length;
    if (totalAfter > MAX_FILES) {
      setGlobalError(`Maximum ${MAX_FILES} files per upload (you tried ${totalAfter}).`);
      return;
    }
    const bytesAfter =
      files.reduce((s, f) => s + f.file.size, 0) + list.reduce((s, f) => s + f.size, 0);
    if (bytesAfter > MAX_TOTAL_BYTES) {
      const mb = (bytesAfter / 1024 / 1024).toFixed(0);
      setGlobalError(`Total size ${mb} MB exceeds 500 MB limit.`);
      return;
    }
    setGlobalError(null);
    const additions: PendingFile[] = list.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
      uploadedBytes: 0,
    }));
    setFiles((prev) => [...prev, ...additions]);
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      const dropped = prev.find((f) => f.id === id);
      if (dropped) URL.revokeObjectURL(dropped.previewUrl);
      return next;
    });
  }

  async function startUploads() {
    if (!event) return;
    setStep('upload');
    const sessionToken = getOrCreateClientSessionToken();

    // Fire all uploads in parallel. setFiles in patches as each progresses.
    await Promise.all(
      files.map((pf) =>
        uploadOne(pf, event.id, sessionToken, sectionTag, (patch) => {
          setFiles((prev) => prev.map((f) => (f.id === pf.id ? { ...f, ...patch } : f)));
        }),
      ),
    );

    setStep('done');
  }

  async function retryFile(id: string) {
    if (!event) return;
    const pf = files.find((f) => f.id === id);
    if (!pf) return;
    const sessionToken = getOrCreateClientSessionToken();
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f,
      ),
    );
    await uploadOne(pf, event.id, sessionToken, sectionTag, (patch) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <StepIndicator step={step} />

      {event && step !== 'pick' && step !== 'done' ? (
        <SelectedEventChip event={event} onClear={() => setStep('pick')} />
      ) : null}

      {globalError ? (
        <p className="rounded-lg border border-red-700/60 bg-red-900/30 px-3 py-2 text-sm text-red-200">
          {globalError}
        </p>
      ) : null}

      {step === 'pick' ? (
        <EventPicker
          onSelect={(ev) => {
            setEvent(ev);
            setStep('files');
          }}
        />
      ) : null}

      {step === 'files' ? (
        <FilesStep
          files={files}
          onAdd={addFiles}
          onRemove={removeFile}
          onNext={() => setStep('tag')}
        />
      ) : null}

      {step === 'tag' ? (
        <TagStep
          sectionTag={sectionTag}
          onPick={setSectionTag}
          onContinue={() => {
            void startUploads();
          }}
        />
      ) : null}

      {step === 'upload' ? <UploadProgress files={files} onRetry={retryFile} /> : null}

      {step === 'done' && event ? (
        <SuccessScreen
          event={event}
          files={files}
          onUploadMore={() => {
            for (const f of files) URL.revokeObjectURL(f.previewUrl);
            setFiles([]);
            setSectionTag(null);
            setStep('files');
          }}
          onViewShow={() => router.push(`/${event.entity.slug}/${event.slug}`)}
        />
      ) : null}
    </div>
  );
}

// ── Step 1: Event picker ─────────────────────────────────────────────────────

type SearchEntity = { id: string; slug: string; name: string; type: string };
type SearchEvent = Omit<EventOption, 'entity'> & {
  entity:
    | { id: string; slug: string; name: string }
    | Array<{ id: string; slug: string; name: string }>;
};

interface SearchResults {
  entities: SearchEntity[];
  events: SearchEvent[];
}

function EventPicker({ onSelect }: { onSelect: (e: EventOption) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ac.signal,
        });
        if (resp.ok) {
          const data: SearchResults = await resp.json();
          if (!ac.signal.aborted) {
            setResults(data);
            setLoading(false);
          }
        }
      } catch {
        // aborted / network — leave state
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Group events under their entity for the result list.
  const grouped = useMemo(() => {
    if (!results) return [];
    type Group = { entity: { id: string; slug: string; name: string }; events: EventOption[] };
    const map = new Map<string, Group>();
    for (const ent of results.entities) {
      map.set(ent.id, { entity: { id: ent.id, slug: ent.slug, name: ent.name }, events: [] });
    }
    for (const ev of results.events) {
      const entity = Array.isArray(ev.entity) ? ev.entity[0] : ev.entity;
      if (!entity) continue;
      if (!map.has(entity.id)) {
        map.set(entity.id, { entity, events: [] });
      }
      map.get(entity.id)!.events.push({ ...ev, entity });
    }
    // Sort events within each group by date descending.
    for (const g of map.values()) {
      g.events.sort((a, b) => b.event_date.localeCompare(a.event_date));
    }
    return Array.from(map.values()).filter((g) => g.events.length > 0);
  }, [results]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Which show did you attend?</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search artist, team, or venue…"
        autoFocus
        className="h-12 w-full rounded-lg border border-ash bg-smoke px-4 text-base placeholder:text-gray-500 focus:border-gray-500 focus:outline-none"
      />

      {!query.trim() ? (
        <p className="text-sm text-gray-500">Try “Morgan Wallen”, “Phillies”, “Gillette”.</p>
      ) : loading && !results ? (
        <p className="text-sm text-gray-400">Searching…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border border-ash bg-smoke p-4 text-sm">
          <p className="text-gray-300">No matches for &ldquo;{query}&rdquo;.</p>
          <button
            type="button"
            onClick={() => setShowSuggestion(true)}
            className="mt-2 text-white underline"
          >
            Can&apos;t find your event?
          </button>
        </div>
      ) : (
        <ul className="space-y-4">
          {grouped.map((g) => (
            <li key={g.entity.id}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
                {g.entity.name}
              </h3>
              <ul className="overflow-hidden rounded-lg border border-ash">
                {g.events.map((ev) => (
                  <li key={ev.id} className="border-b border-ash last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onSelect(ev)}
                      className="flex h-12 w-full items-center justify-between bg-smoke px-4 text-left text-sm hover:bg-ash"
                    >
                      <span>
                        <span className="text-white">{ev.venue_name}</span>
                        <span className="text-gray-400">
                          , {ev.city}
                          {ev.state ? `, ${ev.state}` : ''}
                        </span>
                      </span>
                      <span className="text-xs text-gray-500">{ev.event_date}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && grouped.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowSuggestion(true)}
          className="text-sm text-gray-400 underline hover:text-white"
        >
          Can&apos;t find your event?
        </button>
      ) : null}

      {showSuggestion ? <SuggestionForm onClose={() => setShowSuggestion(false)} /> : null}
    </section>
  );
}

function SuggestionForm({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch('/api/event-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), sessionToken: getOrCreateClientSessionToken() }),
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        setError(json.error ?? 'Failed to submit');
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 p-4 text-sm">
        <p className="text-emerald-200">Thanks — we&apos;ll add it soon.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-xs text-gray-400 underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-ash bg-smoke p-4">
      <label className="block text-sm">
        <span className="text-gray-300">Tell us about the show</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          required
          placeholder="Artist + venue + date — e.g. Zach Bryan at Red Rocks, Aug 12"
          className="mt-1 w-full rounded border border-ash bg-ink px-3 py-2 text-white focus:border-gray-500 focus:outline-none"
        />
      </label>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-md bg-white px-4 text-sm font-medium text-ink hover:bg-gray-200 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-md border border-ash px-4 text-sm text-gray-300 hover:bg-ash"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Step 2: File select ──────────────────────────────────────────────────────

function FilesStep({
  files,
  onAdd,
  onRemove,
  onNext,
}: {
  files: PendingFile[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const totalBytes = files.reduce((s, f) => s + f.file.size, 0);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(1);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onAdd(e.target.files);
      e.target.value = ''; // reset so same file can be re-added after removal
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the drop zone entirely (not just a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) onAdd(e.dataTransfer.files);
  }

  const hasFiles = files.length > 0;

  return (
    <section className="space-y-4">
      {/* Hidden input — multiple lets the OS file picker do multi-select natively */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleChange}
        className="sr-only"
      />

      {!hasFiles ? (
        /* ── Empty state: drop zone matching design ── */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging
              ? 'border-white bg-white/5'
              : 'border-ash/60 bg-smoke/40 hover:border-ash'
          }`}
        >
          {/* Upload icon */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-croll">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <p className="text-base font-semibold text-white">
            {dragging ? 'Drop to add files' : 'Drop your photos and videos here'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            or tap to pick from your camera roll &mdash; up to {MAX_FILES} files
          </p>

          {/* Choose files button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 inline-flex items-center rounded-full bg-croll px-6 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            Choose files
          </button>
        </div>
      ) : (
        /* ── Files selected: thumbnail grid + drop zone overlay ── */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-xl transition ${dragging ? 'ring-2 ring-white/40' : ''}`}
        >
          {dragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-ink/80 text-sm font-semibold text-white">
              Drop to add files
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((f) => (
              <FileThumb key={f.id} file={f} onRemove={() => onRemove(f.id)} />
            ))}

            {files.length < MAX_FILES ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-ash bg-smoke text-gray-400 transition hover:border-gray-500 hover:bg-ash"
                aria-label="Add more files"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="text-[10px]">Add more</span>
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            {files.length} {files.length === 1 ? 'file' : 'files'} &middot; {totalMB} MB
            {files.length < MAX_FILES ? (
              <span className="ml-2 text-gray-600">
                (can add {MAX_FILES - files.length} more)
              </span>
            ) : null}
          </p>
        </div>
      )}

      {!hasFiles && (
        <p className="text-center text-[11px] text-gray-700">
          photos up to 32 MB &middot; videos up to 500 MB &middot; uploads run in background
        </p>
      )}

      {hasFiles ? (
        <div className="sticky bottom-0 -mx-4 mt-6 border-t border-ash bg-ink/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onNext}
            className="h-12 w-full rounded-full bg-white text-base font-semibold text-ink hover:bg-gray-200"
          >
            Continue with {files.length} {files.length === 1 ? 'file' : 'files'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FileThumb({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  const isVideo = file.file.type.startsWith('video/');
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-smoke">
      {isVideo ? (
        <video
          src={file.previewUrl}
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.previewUrl} alt="" className="h-full w-full object-cover" />
      )}
      {isVideo ? (
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
          video
        </span>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
      >
        ×
      </button>
    </div>
  );
}

// ── Step 3: Tag ──────────────────────────────────────────────────────────────

function TagStep({
  sectionTag,
  onPick,
  onContinue,
}: {
  sectionTag: SectionTag | null;
  onPick: (s: SectionTag | null) => void;
  onContinue: () => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Where were you?</h2>
        <p className="text-sm text-gray-400">Optional — helps fans find your view.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {UPLOAD_SECTION_OPTIONS.map((opt) => {
          const active = sectionTag === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(active ? null : opt)}
              className={`h-12 rounded-lg border text-sm font-medium transition ${
                active
                  ? 'border-white bg-white text-ink'
                  : 'border-ash bg-smoke text-gray-200 hover:border-gray-500'
              }`}
            >
              {SECTION_LABELS[opt]}
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 space-y-2 border-t border-ash bg-ink/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onContinue}
          className="h-12 w-full rounded-full bg-white text-base font-semibold text-ink hover:bg-gray-200"
        >
          {sectionTag ? 'Upload' : 'Skip and upload'}
        </button>
      </div>
    </section>
  );
}

// ── Step 4: Upload progress ──────────────────────────────────────────────────

function UploadProgress({
  files,
  onRetry,
}: {
  files: PendingFile[];
  onRetry: (id: string) => void;
}) {
  const totalBytes = files.reduce((s, f) => s + f.file.size, 0) || 1;
  const uploadedBytes = files.reduce((s, f) => s + f.uploadedBytes, 0);
  const overall = Math.min(100, Math.round((uploadedBytes / totalBytes) * 100));
  const doneCount = files.filter((f) => f.status === 'done').length;

  // ETA via simple moving estimate using a startTime ref.
  const startRef = useRef<number | null>(null);
  if (startRef.current == null) startRef.current = Date.now();
  const elapsedSec = (Date.now() - startRef.current) / 1000;
  const speed = elapsedSec > 0 ? uploadedBytes / elapsedSec : 0;
  const remainingBytes = Math.max(0, totalBytes - uploadedBytes);
  const etaSec = speed > 0 ? Math.round(remainingBytes / speed) : null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Uploading…</h2>
      <p className="text-sm text-gray-400">
        Leave this tab open until all files finish.
      </p>

      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-ash">
          <div
            className="h-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${overall}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            {doneCount} of {files.length} uploaded
          </span>
          <span>
            {overall}%
            {etaSec != null && overall < 100 ? ` · ~${formatEta(etaSec)} left` : ''}
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-3 rounded-lg border border-ash bg-smoke p-2"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
              {f.file.type.startsWith('video/') ? (
                <video src={f.previewUrl} muted className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{f.file.name}</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-ash">
                <div
                  className={`h-full transition-all ${
                    f.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${f.progress}%` }}
                />
              </div>
              {f.status === 'error' ? (
                <p className="mt-1 text-xs text-red-300">{f.error ?? 'Failed'}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {f.status === 'done' ? 'Done' : f.status === 'uploading' ? `${f.progress}%` : 'Queued'}
                </p>
              )}
            </div>
            {f.status === 'error' ? (
              <button
                type="button"
                onClick={() => onRetry(f.id)}
                className="h-9 shrink-0 rounded-md border border-red-700/60 px-3 text-xs text-red-200 hover:bg-red-900/30"
              >
                Retry
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Step 5: Success ──────────────────────────────────────────────────────────

function SuccessScreen({
  event,
  files,
  onUploadMore,
  onViewShow,
}: {
  event: EventOption;
  files: PendingFile[];
  onUploadMore: () => void;
  onViewShow: () => void;
}) {
  const doneCount = files.filter((f) => f.status === 'done').length;
  const failedCount = files.filter((f) => f.status === 'error').length;
  const [showAccountPrompt, setShowAccountPrompt] = useState(true);

  return (
    <section className="space-y-6 text-center">
      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">
          Your footage is now part of {event.entity.name}&apos;s archive
        </h2>
        <p className="text-sm text-gray-400">
          {doneCount} {doneCount === 1 ? 'upload' : 'uploads'} added to{' '}
          {event.venue_name}, {event.city}
          {failedCount > 0 ? ` · ${failedCount} failed` : ''}
        </p>
      </div>

      {showAccountPrompt ? (
        <div className="relative rounded-xl border border-ash bg-smoke p-4 text-left">
          <button
            type="button"
            onClick={() => setShowAccountPrompt(false)}
            aria-label="Dismiss"
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-ash hover:text-white"
          >
            ×
          </button>
          <h3 className="text-sm font-semibold">Make these uploads yours</h3>
          <p className="mt-1 text-xs text-gray-400">
            Create an account to track your shows and get notified when your clips
            pick up likes.
          </p>
          <Link
            href="/signup?next=/profile/me"
            className="mt-3 inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-ink hover:bg-gray-200"
          >
            Create an account
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onViewShow}
          className="h-12 flex-1 rounded-full bg-white text-base font-semibold text-ink hover:bg-gray-200"
        >
          View the show
        </button>
        <button
          type="button"
          onClick={onUploadMore}
          className="h-12 flex-1 rounded-full border border-ash bg-smoke text-base font-medium text-white hover:bg-ash"
        >
          Upload more
        </button>
      </div>
    </section>
  );
}

// ── Per-file upload pipeline ─────────────────────────────────────────────────

async function uploadOne(
  pf: PendingFile,
  eventId: string,
  sessionToken: string,
  sectionTag: SectionTag | null,
  onPatch: (patch: Partial<PendingFile>) => void,
): Promise<void> {
  const file = pf.file;
  const isVideo = file.type.startsWith('video/');

  onPatch({ status: 'uploading', progress: 0, uploadedBytes: 0, error: undefined });

  try {
    // 1. Presign / create direct upload.
    let mediaId: string;
    let uploadUrl: string;
    let putContentType: string | undefined;

    if (isVideo) {
      const resp = await fetch('/api/upload/video-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, sessionToken, filename: file.name }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? 'video-url failed');
      const json = await resp.json();
      mediaId = json.mediaId;
      uploadUrl = json.uploadUrl;
      // Mux direct uploads don't need a fixed Content-Type.
    } else {
      const ct = (ALLOWED_PHOTO_MIME.has(file.type) ? file.type : 'image/jpeg').toLowerCase();
      const resp = await fetch('/api/upload/photo-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: ct,
          eventId,
          sessionToken,
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? 'photo-url failed');
      const json = await resp.json();
      mediaId = json.mediaId;
      uploadUrl = json.uploadUrl;
      putContentType = ct; // must match the signed Content-Type.
    }

    // 2. PUT the bytes with progress.
    await putWithProgress(uploadUrl, file, putContentType, (uploaded) => {
      const pct = Math.round((uploaded / file.size) * 100);
      onPatch({ progress: pct, uploadedBytes: uploaded });
    });

    // 3. Mark complete.
    const completeResp = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaId,
        sessionToken,
        sectionTag,
      }),
    });
    if (!completeResp.ok) {
      throw new Error((await completeResp.json()).error ?? 'complete failed');
    }

    onPatch({
      status: 'done',
      progress: 100,
      uploadedBytes: file.size,
      mediaId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'upload failed';
    onPatch({ status: 'error', error: msg });
  }
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string | undefined,
  onProgress: (uploadedBytes: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(file);
  });
}

// ── Tiny UI bits ─────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const stepIndex = (
    { pick: 1, files: 2, tag: 3, upload: 4, done: 4 } as Record<Step, number>
  )[step];
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500">
      <span>Step {stepIndex} of 4</span>
      <div className="h-px flex-1 bg-ash" />
    </div>
  );
}

function SelectedEventChip({
  event,
  onClear,
}: {
  event: EventOption;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-ash bg-smoke px-3 py-2 text-sm">
      <span className="font-medium text-white">{event.entity.name}</span>
      <span className="text-gray-400">
        · {event.venue_name}, {event.city} · {event.event_date}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Change event"
        className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-ash hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}
