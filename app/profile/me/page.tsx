// /profile/me — redirect to the signed-in user's public profile.
// Anonymous visitors land on /signin with ?next=/profile/me so they come back
// here after authenticating, then bounce to /profile/<username>.

import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProfileMePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/signin?next=/profile/me');
  if (!profile.username) redirect('/signup?next=/profile/me');
  redirect(`/profile/${profile.username}`);
}
