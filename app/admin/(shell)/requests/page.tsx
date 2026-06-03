// /admin/requests — content request queue.

import { createAdminClient } from '@/lib/supabase/admin';
import { RequestsQueue } from './requests-queue';

export const dynamic = 'force-dynamic';

export interface ContentRequest {
  id: string;
  type: 'entity' | 'event';
  status: 'pending' | 'approved' | 'rejected';
  requester_email: string;
  payload: Record<string, unknown>;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export default async function RequestsPage() {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('content_requests')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as ContentRequest[];
  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Content Requests</h1>
        {pendingCount > 0 ? (
          <span className="rounded-full bg-croll/20 px-2.5 py-0.5 font-mono text-xs font-bold text-croll">
            {pendingCount} pending
          </span>
        ) : null}
      </div>

      <RequestsQueue rows={rows} />
    </div>
  );
}
