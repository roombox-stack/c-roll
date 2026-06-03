'use client';

import { useState } from 'react';
import type { ContentRequest } from './page';

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function requestSummary(r: ContentRequest) {
  const p = r.payload;
  if (r.type === 'entity') return String(p.name ?? '—');
  return `${String(p.entity_name ?? '?')} @ ${String(p.venue ?? '?')}, ${String(p.date ?? '')}`;
}

export function RequestsQueue({ rows: initial }: { rows: ContentRequest[] }) {
  const [rows, setRows] = useState(initial);
  const [showAll, setShowAll] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = showAll ? rows : rows.filter((r) => r.status === 'pending');

  async function submitAction(id: string, action: 'approve' | 'reject') {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_notes: adminNotes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed');
      }
      const updated = (await res.json()) as ContentRequest;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      setConfirmId(null);
      setAdminNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAll(false)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
            !showAll ? 'bg-ash text-white' : 'text-gray-500 hover:text-white'
          }`}
        >
          Pending only
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
            showAll ? 'bg-ash text-white' : 'text-gray-500 hover:text-white'
          }`}
        >
          All requests
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-600">No requests to show.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-ash">
          <table className="w-full text-sm">
            <thead className="border-b border-ash bg-smoke text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ash">
              {visible.map((row) => (
                <tr key={row.id} className="bg-ink hover:bg-smoke/60">
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.type === 'entity'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-purple-900/50 text-purple-300'
                      }`}
                    >
                      {row.type === 'entity' ? 'Entity' : 'Event'}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-white">
                    {requestSummary(row)}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{row.requester_email}</td>
                  <td className="px-4 py-3 text-gray-500">{formatRelative(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'pending' ? (
                      confirmId === row.id ? (
                        <div className="space-y-2">
                          <textarea
                            placeholder="Admin notes (optional)"
                            rows={2}
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            className="w-full rounded border border-ash bg-smoke px-2 py-1 text-xs text-white placeholder-gray-600"
                          />
                          {actionError && (
                            <p className="text-xs text-red-400">{actionError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              disabled={loading}
                              onClick={() => submitAction(row.id, pendingAction!)}
                              className={`rounded px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                                pendingAction === 'approve'
                                  ? 'bg-green-700 text-white hover:bg-green-600'
                                  : 'bg-red-800 text-white hover:bg-red-700'
                              }`}
                            >
                              {loading ? '…' : `Confirm ${pendingAction}`}
                            </button>
                            <button
                              onClick={() => { setConfirmId(null); setAdminNotes(''); setActionError(null); }}
                              className="rounded px-3 py-1 text-xs text-gray-500 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setConfirmId(row.id); setPendingAction('approve'); }}
                            className="rounded bg-green-900/60 px-3 py-1 text-xs font-medium text-green-300 hover:bg-green-800/60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setConfirmId(row.id); setPendingAction('reject'); }}
                            className="rounded bg-red-900/40 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-800/40"
                          >
                            Reject
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ContentRequest['status'] }) {
  const styles = {
    pending: 'bg-yellow-900/40 text-yellow-300',
    approved: 'bg-green-900/40 text-green-300',
    rejected: 'bg-red-900/40 text-red-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
