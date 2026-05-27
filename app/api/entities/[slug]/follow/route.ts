// POST   /api/entities/[slug]/follow  → follow this entity for the current user
// DELETE /api/entities/[slug]/follow  → unfollow
// GET    /api/entities/[slug]/follow  → { following: boolean, followerCount: number }
//
// All three require an authenticated Supabase session. POST/DELETE are
// idempotent — re-following or re-unfollowing is a no-op rather than an
// error, which keeps optimistic-UI behaviour simple.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

async function fetchEntity(slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('entities')
    .select('id, follower_count')
    .eq('slug', slug)
    .maybeSingle();
  return (data as { id: string; follower_count: number } | null) ?? null;
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  const entity = await fetchEntity(params.slug);
  if (!entity) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!user) {
    return NextResponse.json({ following: false, followerCount: entity.follower_count });
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_id', entity.id)
    .maybeSingle();
  return NextResponse.json({
    following: !!data,
    followerCount: entity.follower_count,
  });
}

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }
  const entity = await fetchEntity(params.slug);
  if (!entity) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const supabase = createAdminClient();

  // Idempotent insert: check first, then insert if missing. Two requests
  // racing each other will be deduped by the unique (user_id, entity_id)
  // index on follows.
  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_id', entity.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from('follows')
      .insert({ user_id: user.id, entity_id: entity.id });
    // 23505 = unique_violation — treat as already-following.
    if (error && (error as { code?: string }).code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Re-read counter (trigger may have updated it).
  const fresh = await fetchEntity(params.slug);
  return NextResponse.json({
    following: true,
    followerCount: fresh?.follower_count ?? entity.follower_count,
  });
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }
  const entity = await fetchEntity(params.slug);
  if (!entity) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', user.id)
    .eq('entity_id', entity.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fresh = await fetchEntity(params.slug);
  return NextResponse.json({
    following: false,
    followerCount: fresh?.follower_count ?? entity.follower_count,
  });
}
