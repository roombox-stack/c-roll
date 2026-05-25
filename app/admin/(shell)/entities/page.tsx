// /admin/entities — list view.

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EntitiesListPage() {
  const supabase = createAdminClient();
  const { data: entities } = await supabase
    .from('entities')
    .select('id, slug, name, type, genre, verified, claimed, follower_count')
    .order('name');

  const rows = entities ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entities</h1>
        <Link
          href="/admin/entities/new"
          className="rounded bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-gray-200"
        >
          + New entity
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-ash bg-smoke">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No entities yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-ash text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Genre</th>
                <th className="px-4 py-2">Flags</th>
                <th className="px-4 py-2 text-right">Followers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-ash hover:bg-ash/30">
                  <td className="px-4 py-2">
                    <Link href={`/admin/entities/${e.id}`} className="block hover:underline">
                      {e.name}
                    </Link>
                    <div className="text-xs text-gray-500">/{e.slug}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {ENTITY_TYPE_LABELS[e.type as EntityType] ?? e.type}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{e.genre ?? '—'}</td>
                  <td className="px-4 py-2">
                    {e.verified && (
                      <span className="mr-1 rounded bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">
                        verified
                      </span>
                    )}
                    {e.claimed && (
                      <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-300">
                        claimed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{e.follower_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
