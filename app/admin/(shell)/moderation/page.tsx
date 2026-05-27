// /admin/moderation — pending_review media queue.
//
// V1 auto-approves uploads to status='active'; this page exists to handle any
// items that get manually moved to 'pending_review' (e.g. flagged content).

import { createAdminClient } from '@/lib/supabase/admin';
import { SECTION_LABELS, type SectionTag } from '@/lib/types';
import { approveMedia, removeMedia, bulkApproveAll } from './actions';
import { SongTagEditor } from '@/components/admin/song-tag-editor';

export const dynamic = 'force-dynamic';

interface PendingMedia {
  id: string;
  file_type: 'photo' | 'video';
  storage_url: string;
  thumbnail_url: string | null;
  song_tag: string | null;
  section_tag: SectionTag | null;
  caption: string | null;
  created_at: string;
  upload_session: string | null;
  event:
    | {
        name: string;
        slug: string;
        setlist: string[] | null;
        entity: { name: string; slug: string } | { name: string; slug: string }[] | null;
      }
    | { name: string; slug: string; setlist: string[] | null; entity: unknown }[]
    | null;
}

export default async function ModerationPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('media')
    .select(
      'id, file_type, storage_url, thumbnail_url, song_tag, section_tag, caption, created_at, upload_session, event:events(name, slug, setlist, entity:entities(name, slug))',
    )
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  const items = (data ?? []) as unknown as PendingMedia[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Moderation queue</h1>
          <p className="text-sm text-gray-400">
            {items.length} {items.length === 1 ? 'item' : 'items'} pending review
          </p>
        </div>
        {items.length > 0 && (
          <form action={bulkApproveAll}>
            <button
              type="submit"
              className="rounded bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-gray-200"
            >
              Approve all
            </button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-ash bg-smoke p-6 text-sm text-gray-400">
          No items pending review. (V1 auto-approves uploads — items only land here
          if an admin manually flags them.)
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => {
            const ev = Array.isArray(m.event) ? m.event[0] : m.event;
            const entity = ev
              ? Array.isArray(ev.entity)
                ? ev.entity[0]
                : ev.entity
              : null;
            const thumb = m.thumbnail_url ?? (m.file_type === 'photo' ? m.storage_url : null);
            return (
              <div key={m.id} className="rounded-lg border border-ash bg-smoke p-3 text-sm">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    className="mb-2 aspect-video w-full rounded object-cover"
                  />
                ) : (
                  <div className="mb-2 flex aspect-video w-full items-center justify-center rounded bg-ink text-xs text-gray-500">
                    {m.file_type} (no preview)
                  </div>
                )}
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {m.file_type} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  {ev && (
                    <div className="text-gray-300">
                      <span className="text-gray-500">
                        {(entity as { name?: string } | null)?.name ?? '—'}
                      </span>{' '}
                      — {ev.name}
                    </div>
                  )}
                  <div className="pt-1">
                    <SongTagEditor
                      mediaId={m.id}
                      currentTag={m.song_tag}
                      setlist={ev?.setlist ?? null}
                    />
                  </div>
                  {m.section_tag && (
                    <div className="text-xs text-gray-400">
                      Section: {SECTION_LABELS[m.section_tag] ?? m.section_tag}
                    </div>
                  )}
                  {m.caption && (
                    <div className="text-xs italic text-gray-400">“{m.caption}”</div>
                  )}
                  <div className="text-xs text-gray-500">
                    {m.upload_session
                      ? `session ${m.upload_session.slice(0, 8)}…`
                      : 'authed user'}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <form action={approveMedia.bind(null, m.id)} className="flex-1">
                    <button
                      type="submit"
                      className="w-full rounded bg-white px-2 py-1 text-xs font-medium text-ink hover:bg-gray-200"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={removeMedia.bind(null, m.id)} className="flex-1">
                    <button
                      type="submit"
                      className="w-full rounded border border-red-700 bg-red-900/40 px-2 py-1 text-xs text-red-200 hover:bg-red-900/60"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
