import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, created_at, upload_count')
    .order('created_at', { ascending: false });

  const rows = users ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <div className="overflow-hidden rounded-lg border border-ash bg-smoke">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No users yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-ash text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-right">Uploads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-ash hover:bg-ash/30">
                  <td className="px-4 py-2">
                    <div>{u.display_name ?? '—'}</div>
                    <div className="text-xs text-gray-500">{u.id}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-400">{u.username ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-400">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">{u.upload_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
