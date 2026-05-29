'use client';

import { useState } from 'react';

type Status = 'pending' | 'approved' | 'rejected';

interface ClaimRow {
  id: string;
  name: string;
  email: string;
  role: string;
  social_handle: string | null;
  entity_type: string;
  message: string | null;
  status: Status;
  admin_notes: string | null;
  entity_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  entity: { id: string; name: string; slug: string } | null;
}

const STATUS_TABS: Array<{ value: 'all' | Status; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const ROLE_LABELS: Record<string, string> = {
  artist: 'Artist',
  manager: 'Manager',
  label: 'Label',
  publicist: 'Publicist',
  other: 'Other',
};

const TYPE_LABELS: Record<string, string> = {
  music: 'Music',
  sports: 'Sports',
  event_brand: 'Event Brand',
  venue: 'Venue',
};

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === 'pending'
      ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
      : status === 'approved'
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : 'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

function ActionPanel({
  claim,
  entityOptions,
  onUpdated,
}: {
  claim: ClaimRow;
  entityOptions: Array<{ id: string; name: string }>;
  onUpdated: (updated: ClaimRow) => void;
}) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [entityId, setEntityId] = useState(claim.entity_id ?? '');
  const [adminNotes, setAdminNotes] = useState(claim.admin_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: 'approved' | 'rejected') {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/claims/${claim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: adminNotes || null, entity_id: entityId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to update claim');
      } else {
        // If a new entity was auto-created, fold it into the claim row so the
        // "Linked →" line shows up immediately without a page reload.
        const entity = data.created_entity ?? claim.entity ?? null;
        onUpdated({ ...claim, ...data, entity });
        setAction(null);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (claim.status !== 'pending') return null;

  if (!action) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setAction('approve')}
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 transition hover:bg-emerald-500/20"
        >
          Approve
        </button>
        <button
          onClick={() => setAction('reject')}
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20"
        >
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      {action === 'approve' && (
        <div className="space-y-1">
          <label className="block text-xs text-gray-400">
            Link to existing entity{' '}
            <span className="text-gray-600">(leave blank to auto-create a new one)</span>
          </label>
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="w-full rounded border border-ash bg-ink px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
          >
            <option value="">— Create new entity from claim —</option>
            {entityOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1">
        <label className="block text-xs text-gray-400">Admin notes</label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={2}
          placeholder="Optional internal notes…"
          className="w-full resize-none rounded border border-ash bg-ink px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
        />
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={() => submit(action === 'approve' ? 'approved' : 'rejected')}
          disabled={saving}
          className={`rounded px-4 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            action === 'approve'
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {saving ? 'Saving…' : action === 'approve' ? 'Confirm approve' : 'Confirm reject'}
        </button>
        <button
          onClick={() => setAction(null)}
          className="rounded border border-ash px-4 py-1.5 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ClaimCard({
  claim,
  entityOptions,
  onUpdated,
}: {
  claim: ClaimRow;
  entityOptions: Array<{ id: string; name: string }>;
  onUpdated: (updated: ClaimRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const msgTruncated = claim.message && claim.message.length > 100;
  const displayMsg = expanded || !msgTruncated
    ? claim.message
    : claim.message?.slice(0, 100) + '…';

  return (
    <div className="rounded-lg border border-ash bg-smoke p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="font-semibold text-white">{claim.name}</p>
          <p className="text-sm text-gray-400">{claim.email}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-400">
              {ROLE_LABELS[claim.role] ?? claim.role}
            </span>
            <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-400">
              {TYPE_LABELS[claim.entity_type] ?? claim.entity_type}
            </span>
            {claim.social_handle ? (
              <span className="font-mono text-[11px] text-gray-500">{claim.social_handle}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={claim.status} />
          <p className="font-mono text-[10px] text-gray-600">
            {new Date(claim.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {claim.message ? (
        <div>
          <p className="text-sm text-gray-400">{displayMsg}</p>
          {msgTruncated ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-gray-600 hover:text-gray-400"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          ) : null}
        </div>
      ) : null}

      {claim.status === 'approved' && claim.entity ? (
        <p className="font-mono text-[11px] text-emerald-400/70">
          Linked → {claim.entity.name} (/{claim.entity.slug})
        </p>
      ) : null}

      {claim.admin_notes && claim.status !== 'pending' ? (
        <p className="rounded bg-white/5 px-3 py-2 text-xs text-gray-500">
          <span className="text-gray-600">Notes: </span>{claim.admin_notes}
        </p>
      ) : null}

      <ActionPanel claim={claim} entityOptions={entityOptions} onUpdated={onUpdated} />
    </div>
  );
}

export function ClaimsQueue({
  rows: initialRows,
  entityOptions,
}: {
  rows: ClaimRow[];
  entityOptions: Array<{ id: string; name: string }>;
}) {
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState<'all' | Status>('pending');

  function handleUpdated(updated: ClaimRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const filtered = tab === 'all' ? rows : rows.filter((r) => r.status === tab);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-ash pb-0">
        {STATUS_TABS.map((t) => {
          const count = t.value === 'all' ? rows.length : rows.filter((r) => r.status === t.value).length;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 text-sm transition border-b-2 -mb-px ${
                tab === t.value
                  ? 'border-croll text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
              {count > 0 ? (
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No {tab === 'all' ? '' : tab} requests.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              entityOptions={entityOptions}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
