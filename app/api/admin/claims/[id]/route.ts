// PATCH /api/admin/claims/[id]
// Requires admin auth (middleware guards /api/admin/*).
// Updates claim status, optionally links to an entity and marks it claimed.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { status, admin_notes, entity_id } = body as {
    status?: string;
    admin_notes?: string;
    entity_id?: string;
  };

  const validStatuses = ['approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: 'status must be "approved" or "rejected"' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Fetch the claim first (need email for claimed_by)
  const { data: claim, error: fetchErr } = await supabase
    .from('page_claims')
    .select('id, email')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchErr || !claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  // Update the claim row
  const { data: updated, error: updateErr } = await supabase
    .from('page_claims')
    .update({
      status,
      admin_notes: admin_notes ?? null,
      entity_id: entity_id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) {
    console.error('claims PATCH update error:', updateErr);
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
  }

  // If approving and an entity was linked, mark the entity as claimed
  if (status === 'approved' && entity_id) {
    const { error: entityErr } = await supabase
      .from('entities')
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
        claimed_by: claim.email,
      })
      .eq('id', entity_id);

    if (entityErr) {
      console.error('claims PATCH entity update error:', entityErr);
      // Non-fatal — return the claim update but note the entity update failed
    }
  }

  return NextResponse.json(updated);
}
