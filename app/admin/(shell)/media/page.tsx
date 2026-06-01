// /admin/media — view and manage all uploaded media.
//
// Shows every media row (all statuses) with thumbnail preview, event/entity
// info, uploader, and per-row actions: activate (for stuck uploads), soft-
// delete (status=removed), or hard-delete (permanent).
//
// URL params:
//   ?status=all|active|uploading|removed  (default: all)
//   ?entity=<entity_id>
//   ?event=<event_id>
//   ?page=N  (25 per page)

import Link from 'next/link';
import { deleteMedia, activateMedia } from './actions';
import { HardDeleteButton } from './delete-button';
import { SongTagEditor } from '@/components/admin/song-tag-editor';
import { AdminMediaFilters } from '@/components/admin/media-filters';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'uploading', label: 'Stuck / uploading' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'removed', label: 'Removed' },
];

interface MediaRow {
  id: string;
  file_type: 'photo' | 'video';
  status: string;
  storage_url: string;
  thumbnail_url: string | null;
  mux_playback_id: string | null;
  duration_sec: number | null;
  song_tag: string | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  uploader_id: string | null;
  upload_session: string | null;
  event:
    | {
        id: string;
        name: string;
        slug: string;
        setlist: string[] | null;
        entity: { name: string; slug: string } | null;
      }
    | null;
}

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string; entity?: string; event?: string };
}) {
  const supabase = createAdminClient();
  const statusFilter = searchParams.status ?? 'all';
  const entityFilter = searchParams.entity ?? '';
  const eventFilter = searchParams.event ?? '';
  const page = Math.max(1, Number(searchParams.page ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Fetch all entities for the filter dropdown.
  const { data: entitiesRaw } = await supabase
    .from('entities')
    .select('id, slug, name')
    .order('name', { ascending: true })
    .limit(500);
  const entities = (entitiesRaw ?? []) as { id: string; slug: string; name: string }[];

  let query = supabase
    .from('media')
    .select(
      'id, file_type, status, storage_url, thumbnail_url, mux_playback_id, duration_sec, song_tag, caption, view_count, like_count, created_at, uploader_id, upload_session, event:events(id, name, slug, setlist, entity_id, entity:entities(name, slug))',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (eventFilter) {
    query = query.eq('event_id', eventFilter);
  } else if (entityFilter) {
    query = query.eq('entity_id', entityFilter);
  }

  const { data, count } = await query;
  const items = (data ?? []) as unknown as MediaRow[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (entityFilter) params.set('entity', entityFilter);
    if (eventFilter) params.set('event', eventFilter);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/admin/media${s ? `?${s}` : ''}`;
  }

  function statusHref(s: string) {
    const params = new URLSearchParams();
    if (s !== 'all') params.set('status', s);
    if (entityFilter) params.set('entity', entityFilter);
    if (eventFilter) params.set('event', eventFilter);
    const str = params.toString();
    return `/admin/media${str ? `?${str}` : ''}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Media uploads</h1>
          <p className="text-sm text-gray-400">{total.toLocaleString()} rows matching filter</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={statusHref(opt.value)}
            className={`rounded-full border px-4 py-1 text-sm transition ${
              statusFilter === opt.value
                ? 'border-white bg-white text-ink'
                : 'border-ash text-gray-400 hover:border-gray-500 hover:text-white'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Entity + Event filters */}
      <AdminMediaFilters
        entities={entities}
        initialEntityId={entityFilter}
        initialEventId={eventFilter}
      />

      {/* Table */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
          No items match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ash">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ash bg-smoke text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-3">Preview</th>
                <th className="px-3 py-3">Event / Entity</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Views</th>
                <th className="px-3 py-3">Uploader</th>
                <th className="px-3 py-3">Uploaded</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ash/50">
              {items.map((m) => {
                const ev = Array.isArray(m.event) ? (m.event as unknown as MediaRow['event'][])[0] : m.event;
                const entity = ev
                  ? Array.isArray(ev.entity)
                    ? (ev.entity as unknown as { name: string; slug: string }[])[0]
                    : ev.entity
                  : null;
                const thumb = m.thumbnail_url ?? (m.file_type === 'photo' ? m.storage_url : null);
                const isStuck = m.status === 'uploading';
                const isActive = m.status === 'active';

                return (
                  <tr key={m.id} className="hover:bg-smoke/60">
                    {/* Thumbnail */}
                    <td className="px-3 py-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-14 w-24 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-24 items-center justify-center rounded bg-ash text-[10px] text-gray-500">
                          {isStuck ? 'processing…' : 'no thumb'}
                        </div>
                      )}
                    </td>

                    {/* Event / Entity */}
                    <td className="max-w-[200px] px-3 py-2">
                      {entity && (
                        <Link
                          href={`/${entity.slug}`}
                          className="block truncate text-xs text-gray-400 hover:text-white"
                          target="_blank"
                        >
                          {entity.name}
                        </Link>
                      )}
                      {ev && (
                        <Link
                          href={`/${entity?.slug ?? ''}/${ev.slug}`}
                          className="block truncate text-xs text-white hover:underline"
                          target="_blank"
                        >
                          {ev.name}
                        </Link>
                      )}
                      {m.file_type === 'video' ? (
                      <div className="mt-1">
                        <SongTagEditor
                          mediaId={m.id}
                          currentTag={m.song_tag}
                          setlist={ev?.setlist ?? null}
                        />
                      </div>
                      ) : null}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2">
                      <span className="rounded bg-ash px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        {m.file_type}
                        {m.duration_sec ? ` ${Math.round(m.duration_sec)}s` : ''}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          m.status === 'active'
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : m.status === 'uploading'
                              ? 'bg-amber-900/50 text-amber-300'
                              : m.status === 'removed'
                                ? 'bg-red-900/50 text-red-300'
                                : 'bg-ash text-gray-400'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>

                    {/* Views */}
                    <td className="px-3 py-2 tabular-nums text-gray-400">
                      {m.view_count.toLocaleString()}
                    </td>

                    {/* Uploader */}
                    <td className="max-w-[120px] px-3 py-2 text-[11px] text-gray-500">
                      {m.uploader_id ? (
                        <span title={m.uploader_id}>user {m.uploader_id.slice(0, 8)}…</span>
                      ) : m.upload_session ? (
                        <span title={m.upload_session}>anon {m.upload_session.slice(0, 8)}…</span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-gray-500">
                      {new Date(m.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      <br />
                      {new Date(m.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {isActive && (
                          <Link
                            href={`/watch/${m.id}`}
                            target="_blank"
                            className="rounded border border-ash px-2 py-1 text-center text-[10px] text-gray-300 hover:bg-ash"
                          >
                            View
                          </Link>
                        )}
                        {isStuck && (
                          <form action={activateMedia.bind(null, m.id)}>
                            <button
                              type="submit"
                              className="w-full rounded border border-emerald-700 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-900/40"
                            >
                              Force active
                            </button>
                          </form>
                        )}
                        {m.status !== 'removed' && (
                          <form action={deleteMedia.bind(null, m.id)}>
                            <button
                              type="submit"
                              className="w-full rounded border border-amber-800 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-900/40"
                            >
                              Remove
                            </button>
                          </form>
                        )}
                        <HardDeleteButton id={m.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded border border-ash px-3 py-1 hover:bg-ash">
              ← Prev
            </Link>
          )}
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="rounded border border-ash px-3 py-1 hover:bg-ash">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
