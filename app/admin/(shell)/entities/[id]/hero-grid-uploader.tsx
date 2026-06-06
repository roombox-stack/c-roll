'use client';

// Admin upload panel for adding new clips directly from the entity page.
//
// Flow:
//   1. Admin picks an event from the dropdown.
//   2. Admin drops / selects files (photos or videos).
//   3. For each file we call adminPresignPhoto / adminPresignVideo to create the
//      media row + get a presigned URL, then PUT the file directly to R2 / Mux.
//   4. Photos are activated immediately via adminActivateMedia. Videos activate
//      automatically once the Mux webhook fires.
//   5. On completion we call router.refresh() so the picker gallery reloads.

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminPresignPhoto, adminPresignVideo, adminActivateMedia } from '../actions';

export interface EventOption {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
}

interface UploadItem {
  id: string; // local key
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number; // 0–100
  error?: string;
}

const ALLOWED_PHOTO = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/mov', 'video/mpeg', 'video/webm']);

export function HeroGridUploader({ events }: { events: EventOption[] }) {
  const [open, setOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id ?? '');
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function uploadFile(item: UploadItem, eventId: string) {
    updateItem(item.id, { status: 'uploading', progress: 5 });
    const { file } = item;
    const isPhoto = ALLOWED_PHOTO.has(file.type);
    const isVideo = ALLOWED_VIDEO.has(file.type);

    if (!isPhoto && !isVideo) {
      updateItem(item.id, { status: 'error', error: 'Unsupported file type' });
      return;
    }

    try {
      let uploadUrl: string;
      let mediaId: string;

      if (isPhoto) {
        const res = await adminPresignPhoto(eventId, file.name, file.type);
        uploadUrl = res.uploadUrl;
        mediaId = res.mediaId;
      } else {
        const res = await adminPresignVideo(eventId);
        uploadUrl = res.uploadUrl;
        mediaId = res.mediaId;
      }

      updateItem(item.id, { progress: 20 });

      // PUT the file to R2 / Mux using XHR so we get upload progress.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        if (isPhoto) xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 70) + 20; // 20–90
            updateItem(item.id, { progress: pct });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`PUT failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('network error'));
        xhr.send(file);
      });

      updateItem(item.id, { progress: 90 });

      if (isPhoto) {
        await adminActivateMedia(mediaId);
      }

      updateItem(item.id, { status: 'done', progress: 100 });
    } catch (e) {
      updateItem(item.id, { status: 'error', error: e instanceof Error ? e.message : 'upload failed' });
    }
  }

  function enqueueFiles(files: FileList | File[]) {
    if (!selectedEventId) return;
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0,
    }));
    setQueue((q) => [...q, ...newItems]);
    // kick off uploads sequentially to avoid hammering Mux / R2
    (async () => {
      for (const item of newItems) {
        await uploadFile(item, selectedEventId);
      }
      router.refresh();
    })();
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) enqueueFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEventId, queue],
  );

  const pending = queue.filter((i) => i.status === 'uploading' || i.status === 'pending').length;
  const done = queue.filter((i) => i.status === 'done').length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded border border-ash px-3 py-1.5 text-xs text-gray-400 transition hover:border-gray-500 hover:text-white"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Upload clips
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-ash bg-smoke/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Upload clips</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-white"
        >
          Close
        </button>
      </div>

      {/* Event picker */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Attach to event</label>
        {events.length === 0 ? (
          <p className="text-xs text-red-400">No events found for this entity. Create an event first.</p>
        ) : (
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full rounded border border-ash bg-ink px-3 py-1.5 text-sm text-white"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}{ev.city ? ` — ${ev.city}` : ''}{ev.event_date ? ` (${ev.event_date.slice(0, 10)})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Drop zone */}
      {events.length > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 transition ${
            dragging ? 'border-croll bg-croll/10' : 'border-ash hover:border-gray-500'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-xs text-gray-500">Drop photos or videos here, or click to browse</p>
          <p className="text-[10px] text-gray-600">JPEG · PNG · WEBP · HEIC · MP4 · MOV</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/x-m4v,video/mov,video/webm"
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) enqueueFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {queue.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded border border-ash/50 bg-smoke px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="truncate text-[11px] text-white">{item.file.name}</p>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ash">
                    <div
                      className="h-full rounded-full bg-croll transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <p className="text-[10px] text-red-400">{item.error}</p>
                )}
              </div>
              <span className={`shrink-0 text-[10px] font-medium ${
                item.status === 'done' ? 'text-emerald-400'
                : item.status === 'error' ? 'text-red-400'
                : item.status === 'uploading' ? 'text-amber-300'
                : 'text-gray-500'
              }`}>
                {item.status === 'done' ? '✓ done'
                  : item.status === 'error' ? 'error'
                  : item.status === 'uploading' ? `${item.progress}%`
                  : 'queued'}
              </span>
            </div>
          ))}
          {pending === 0 && done > 0 && (
            <p className="text-center text-xs text-emerald-400">
              {done} clip{done !== 1 ? 's' : ''} uploaded — gallery updated below
            </p>
          )}
        </div>
      )}
    </div>
  );
}
