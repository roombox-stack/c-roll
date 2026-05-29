// PATCH /api/admin/claims/[id]
// Requires admin auth (middleware guards /api/admin/*).
// Updates claim status. On approval:
//   - If entity_id provided: links to that existing entity and marks it claimed.
//   - If no entity_id: auto-creates a new entity from the claim data, marks it
//     claimed, and returns the new entity in the response.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Map claim entity_type → entities.type DB enum
const ENTITY_TYPE_MAP: Record<string, string> = {
  music: 'artist',
  sports: 'team',
  event_brand: 'event_brand',
  venue: 'venue',
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

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

  // Fetch the full claim (need name/email/entity_type for auto-create)
  const { data: claim, error: fetchErr } = await supabase
    .from('page_claims')
    .select('id, name, email, entity_type')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchErr || !claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  let resolvedEntityId = entity_id ?? null;
  let createdEntity: { id: string; slug: string; name: string } | null = null;

  // On approval, ensure an entity exists
  if (status === 'approved') {
    if (resolvedEntityId) {
      // Link to existing entity — mark it claimed
      await supabase
        .from('entities')
        .update({
          claimed: true,
          claimed_at: new Date().toISOString(),
          claimed_by: claim.email,
        })
        .eq('id', resolvedEntityId);
    } else {
      // Auto-create a new entity from the claim data
      const dbType = ENTITY_TYPE_MAP[claim.entity_type] ?? 'artist';
      const slug = slugify(claim.name);

      const { data: newEntity, error: createErr } = await supabase
        .from('entities')
        .insert({
          name: claim.name,
          slug,
          type: dbType,
          claimed: true,
          claimed_at: new Date().toISOString(),
          claimed_by: claim.email,
        })
        .select('id, slug, name')
        .single();

      if (createErr) {
        console.error('claims PATCH entity create error:', createErr);
        return NextResponse.json({ error: 'Failed to create entity: ' + createErr.message }, { status: 500 });
      }

      resolvedEntityId = newEntity.id;
      createdEntity = newEntity;
    }
  }

  // Update the claim row
  const { data: updated, error: updateErr } = await supabase
    .from('page_claims')
    .update({
      status,
      admin_notes: admin_notes ?? null,
      entity_id: resolvedEntityId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) {
    console.error('claims PATCH update error:', updateErr);
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
  }

  return NextResponse.json({ ...updated, created_entity: createdEntity });
}
