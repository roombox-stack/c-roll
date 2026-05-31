import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const ROLE_BADGES: Record<string, string> = {
  admin: 'bg-red-900/40 text-red-300',
  artist: 'bg-blue-900/40 text-blue-300',
  user: 'bg-gray-800 text-gray-400',
};

export default async function UsersPage() {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name, created_at, upload_count, role')
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
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-right">Uploads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const role = (u.role as string) ?? 'user';
                return (
                  <tr key={u.id} className="border-t border-ash hover:bg-ash/30">
                    <td className="px-4 py-2">
                      <div>{u.display_name ?? '—'}</div>
                      <div className="text-xs text-gray-500">{u.id}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-400">{u.username ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGES[role] ?? ROLE_BADGES.user}`}>
                        {role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">{u.upload_count ?? 0}</td>
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
