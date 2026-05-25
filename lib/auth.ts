// Server-side auth helpers. Use these in Server Components and Route Handlers
// to read the current Supabase session.

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  upload_count: number;
  show_count: number;
  created_at: string;
}

/** Returns the authenticated Supabase user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Returns the public.users profile for the current session, or null. */
export async function getCurrentProfile(): Promise<PublicProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, bio, upload_count, show_count, created_at')
    .eq('id', user.id)
    .maybeSingle();
  return (data as PublicProfile | null) ?? null;
}
