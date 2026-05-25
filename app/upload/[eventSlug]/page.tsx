// /upload/[eventSlug] — same flow but with the event preselected. The picker
// step is skipped; the user lands on file selection directly.
//
// 404s if the slug doesn't match a real event so the QR-code links can't be
// mistyped.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Nav } from '@/components/nav';
import { UploadFlow, type EventOption } from '../upload-flow';

export const dynamic = 'force-dynamic';

interface DbEventRow {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  entity: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

async function fetchEvent(slug: string): Promise<EventOption | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('events')
    .select('id, slug, name, venue_name, city, state, event_date, entity:entities(slug, name)')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as DbEventRow;
  const entity = Array.isArray(row.entity) ? row.entity[0] : row.entity;
  if (!entity) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    venue_name: row.venue_name,
    city: row.city,
    state: row.state,
    event_date: row.event_date,
    entity,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { eventSlug: string };
}): Promise<Metadata> {
  const event = await fetchEvent(params.eventSlug);
  if (!event) return { title: 'Upload' };
  return {
    title: `Upload to ${event.entity.name} — ${event.venue_name}`,
    description: `Add your photos and videos from ${event.entity.name} at ${event.venue_name}.`,
    robots: { index: false },
  };
}

export default async function UploadEventPage({
  params,
}: {
  params: { eventSlug: string };
}) {
  const event = await fetchEvent(params.eventSlug);
  if (!event) notFound();
  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <UploadFlow initialEvent={event} />
      </main>
    </div>
  );
}
