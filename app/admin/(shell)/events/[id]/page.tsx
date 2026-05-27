// /admin/events/[id] — edit form + QR code panel.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Field, TextareaField, SubmitButton } from '@/components/admin/form-fields';
import { BulkSongTagger, type TaggableMedia } from '@/components/admin/bulk-song-tagger';
import { updateEvent } from '../actions';

export const dynamic = 'force-dynamic';

interface EventEditRow {
  id: string;
  entity_id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  country: string;
  event_date: string;
  tour_name: string | null;
  setlist: string[] | null;
  upload_count: number;
  photo_count: number;
  video_count: number;
  entity: { id: string; name: string; slug: string } | null;
}

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('events')
    .select('*, entity:entities(id, name, slug)')
    .eq('id', params.id)
    .maybeSingle();

  if (!data) notFound();
  const event = data as unknown as EventEditRow;
  const entity = Array.isArray(event.entity) ? event.entity[0] : event.entity;

  // All media for this event — fed to the bulk song tagger below.
  const { data: mediaRaw } = await supabase
    .from('media')
    .select('id, file_type, thumbnail_url, storage_url, song_tag, created_at')
    .eq('event_id', event.id)
    .neq('status', 'removed')
    .order('created_at', { ascending: true });
  const taggableMedia = (mediaRaw ?? []) as TaggableMedia[];

  const setlistText = Array.isArray(event.setlist) ? event.setlist.join('\n') : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const qrUrl = `/api/events/${event.slug}/qr?size=512`;
  const qrUrlHi = `/api/events/${event.slug}/qr?size=1024`;
  const uploadUrl = `${appUrl}/upload/${event.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/events" className="text-sm text-gray-400 hover:text-white">
          ← Events
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-gray-500">
          {entity?.name ?? '—'} · {event.event_date} · /{event.slug}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <form action={updateEvent.bind(null, event.id)} className="space-y-4">
          <Field label="Name" name="name" defaultValue={event.name} required />
          <Field label="Slug" name="slug" defaultValue={event.slug} required />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Venue name"
              name="venue_name"
              defaultValue={event.venue_name}
              required
            />
            <Field
              label="Event date"
              name="event_date"
              type="date"
              defaultValue={event.event_date}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="City" name="city" defaultValue={event.city} required />
            <Field label="State" name="state" defaultValue={event.state ?? ''} />
            <Field label="Country" name="country" defaultValue={event.country} required />
          </div>
          <Field
            label="Tour name"
            name="tour_name"
            defaultValue={event.tour_name ?? ''}
          />
          <TextareaField
            label="Setlist (one song per line, in order)"
            name="setlist"
            rows={12}
            defaultValue={setlistText}
          />
          <SubmitButton>Save</SubmitButton>
        </form>

        <aside className="space-y-4">
          <div className="rounded-lg border border-ash bg-smoke p-4">
            <h3 className="mb-2 text-sm font-semibold">QR code</h3>
            <p className="mb-3 break-all text-xs text-gray-400">{uploadUrl}</p>
            {/* Browser-loaded image — fine to use a plain <img> for admin chrome */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR code for ${event.name}`}
              className="w-full rounded bg-white p-2"
            />
            <a
              href={qrUrlHi}
              download={`c-roll-${event.slug}.png`}
              className="mt-3 block rounded border border-ash px-3 py-2 text-center text-sm hover:bg-ash"
            >
              Download high-res PNG
            </a>
          </div>

          <div className="rounded-lg border border-ash bg-smoke p-4 text-sm">
            <h3 className="mb-2 text-sm font-semibold">Counts</h3>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Uploads</span>
              <span>{event.upload_count}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Photos</span>
              <span>{event.photo_count}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Videos</span>
              <span>{event.video_count}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Tag Media ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Tag media</h2>
          <p className="text-xs text-gray-500">
            Assign a song from the setlist to each clip. Custom titles are allowed.
            Changes don&rsquo;t save until you click &ldquo;Save all&rdquo;.
          </p>
        </div>
        <BulkSongTagger
          media={taggableMedia}
          setlist={Array.isArray(event.setlist) ? event.setlist : []}
        />
      </section>
    </div>
  );
}
