import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

async function resolveTargetId(username: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select('id, follower_count, following_count')
    .eq('username', username)
    .maybeSingle();
  return data ? data.id : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } },
) {
  const supabase = createAdminClient();
  const currentUser = await getCurrentUser();

  const { data: target } = await supabase
    .from('users')
    .select('id, follower_count, following_count')
    .eq('username', params.username)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let following = false;
  if (currentUser) {
    const { data: row } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', target.id)
      .maybeSingle();
    following = row != null;
  }

  return NextResponse.json({
    following,
    followerCount: target.follower_count ?? 0,
    followingCount: target.following_count ?? 0,
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { username: string } },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const targetId = await resolveTargetId(params.username);
  if (!targetId) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (targetId === currentUser.id)
    return NextResponse.json({ error: 'cannot follow yourself' }, { status: 400 });

  const supabase = createAdminClient();
  await supabase
    .from('user_follows')
    .upsert({ follower_id: currentUser.id, following_id: targetId }, { onConflict: 'follower_id,following_id' });

  const { data: target } = await supabase
    .from('users')
    .select('follower_count, following_count')
    .eq('id', targetId)
    .maybeSingle();

  return NextResponse.json({ following: true, followerCount: target?.follower_count ?? 0 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { username: string } },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const targetId = await resolveTargetId(params.username);
  if (!targetId) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const supabase = createAdminClient();
  await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', currentUser.id)
    .eq('following_id', targetId);

  const { data: target } = await supabase
    .from('users')
    .select('follower_count, following_count')
    .eq('id', targetId)
    .maybeSingle();

  return NextResponse.json({ following: false, followerCount: target?.follower_count ?? 0 });
}
