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
    .select('follower:users!follower_id(id, username, display_name, avatar_url)')
    .eq('following_id', target.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const followers = (rows ?? []).map((r) => {
    const u = Array.isArray(r.follower) ? r.follower[0] : r.follower;
    return u;
  }).filter(Boolean);

  // Check which of these users the current user is following.
  let followingSet = new Set<string>();
  if (currentUser && followers.length > 0) {
    const ids = followers.map((u: { id: string }) => u.id);
    const { data: myFollows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', currentUser.id)
      .in('following_id', ids);
    followingSet = new Set((myFollows ?? []).map((r) => r.following_id));
  }

  return NextResponse.json(
    followers.map((u: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => ({
      ...u,
      isFollowing: followingSet.has(u.id),
      isCurrentUser: u.id === currentUser?.id,
    })),
  );
}
