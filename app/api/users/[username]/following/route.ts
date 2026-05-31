import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } },
) {
  const supabase = createAdminClient();

  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('username', params.username)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const currentUser = await getCurrentUser();

  const { data: rows } = await supabase
    .from('user_follows')
    .select('following:users!following_id(id, username, display_name, avatar_url)')
    .eq('follower_id', target.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const following = (rows ?? []).map((r) => {
    const u = Array.isArray(r.following) ? r.following[0] : r.following;
    return u;
  }).filter(Boolean);

  let followingSet = new Set<string>();
  if (currentUser && following.length > 0) {
    const ids = following.map((u: { id: string }) => u.id);
    const { data: myFollows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', currentUser.id)
      .in('following_id', ids);
    followingSet = new Set((myFollows ?? []).map((r) => r.following_id));
  }

  return NextResponse.json(
    following.map((u: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => ({
      ...u,
      isFollowing: followingSet.has(u.id),
      isCurrentUser: u.id === currentUser?.id,
    })),
  );
}
