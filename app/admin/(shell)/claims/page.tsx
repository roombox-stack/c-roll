// /admin/claims — page claim requests queue.

import { createAdminClient } from '@/lib/supabase/admin';
import { ClaimsQueue } from './claims-queue';

export const dynamic = 'force-dynamic';

interface ClaimRow {
  id: string;
  name: string;
  email: string;
  role: string;
  social_handle: string | null;
  entity_type: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  entity_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  entity: { id: string; name: string; slug: string } | null;
}

export default async function ClaimsPage() {
  const supabase = createAdminClient();

  const [{ data: claims }, { data: entities }] = await Promise.all([
    supabase
      .from('page_claims')
      .select('*, entity:entities(id, name, slug)')
      .order('created_at', { ascending: false }),
    supabase.from('entities').select('id, name').order('name'),
  ]);

  const rows = (claims ?? []) as unknown as ClaimRow[];
  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const entityOptions = (entities ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Page Requests</h1>
        {pendingCount > 0 ? (
          <span className="rounded-full bg-croll/20 px-2.5 py-0.5 font-mono text-xs font-bold text-croll">
            {pendingCount} pending
          </span>
        ) : null}
      </div>

      <ClaimsQueue rows={rows} entityOptions={entityOptions} />
    </div>
  );
}
