// /admin/events — list view.

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { EventsFilter } from '@/components/admin/events-filter';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  event_date: string;
  upload_count: number;
  entity: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

export default async function EventsListPage({
  searchParams,
}: {
  searchParams: { entity?: string; from?: string; to?: string };
}) {
  const supabase = createAdminClient();

  let query = supabase
    .from('events')
    .select(
      'id, slug, name, venue_name, city, state, event_date, upload_count, entity:entities(name, slug)',
    );

  if (searchParams.entity) query = query.eq('entity_id', searchParams.entity);
  if (searchParams.from) query = query.gte('event_date', searchParams.from);
  if (searchParams.to) query = query.lte('event_date', searchParams.to);

  const [{ data }, { data: entities }] = await Promise.all([
    query.order('event_date', { ascending: false }),
    supabase.from('entities').select('id, name').order('name'),
  ]);

  const rows = (data ?? []) as unknown as EventRow[];
  const entityOptions = (entities ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link
          href="/admin/events/new"
          className="rounded bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-gray-200"
        >
          + New event
        </Link>
      </div>

      <EventsFilter entities={entityOptions} />

      <div className="overflow-hidden rounded-lg border border-ash bg-smoke">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No events match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-ash text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Venue</th>
                <th className="px-4 py-2 text-right">Uploads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const entity = Array.isArray(e.entity) ? e.entity[0] : e.entity;
                return (
                  <tr key={e.id} className="border-t border-ash hover:bg-ash/30">
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{e.event_date}</td>
                    <td className="px-4 py-2">
                      <Link href={`/admin/events/${e.id}`} className="hover:underline">
                        {e.name}
                      </Link>
                      <div className="text-xs text-gray-500">/{e.slug}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-400">{entity?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-400">
                      {e.venue_name}, {e.city}
                      {e.state ? `, ${e.state}` : ''}
                    </td>
                    <td className="px-4 py-2 text-right">{e.upload_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
