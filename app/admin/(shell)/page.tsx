// Admin dashboard: header counts + top-5 events by upload.

import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface TopEvent {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  event_date: string;
  upload_count: number;
  entity: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

export default async function AdminDashboard() {
  const supabase = createAdminClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [entities, events, media, users, recent, top] = await Promise.all([
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('media').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('events')
      .select(
        'id, slug, name, venue_name, city, event_date, upload_count, entity:entities(name, slug)',
      )
      .order('upload_count', { ascending: false })
      .limit(5),
  ]);

  const topEvents = (top.data ?? []) as unknown as TopEvent[];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Entities" value={entities.count ?? 0} />
        <Stat label="Events" value={events.count ?? 0} />
        <Stat label="Active media" value={media.count ?? 0} />
        <Stat label="Users" value={users.count ?? 0} />
        <Stat label="Uploads (7d)" value={recent.count ?? 0} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Top events by uploads</h2>
        <div className="overflow-hidden rounded-lg border border-ash bg-smoke">
          {topEvents.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-ash text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Entity</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">Uploads</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.map((e) => {
                  const entity = Array.isArray(e.entity) ? e.entity[0] : e.entity;
                  return (
                    <tr key={e.id} className="border-t border-ash">
                      <td className="px-4 py-2">{e.name}</td>
                      <td className="px-4 py-2 text-gray-400">{entity?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-400">{e.event_date}</td>
                      <td className="px-4 py-2 text-right">{e.upload_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ash bg-smoke p-4">
      <div className="text-xs uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
