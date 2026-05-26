// /profile/me/edit — profile edit page.
//
// Auth-gated server component: loads the current user's profile and passes it
// to the client form. Unauthenticated visitors are redirected to /signin.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { ProfileEditForm } from './profile-edit-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit profile',
  robots: { index: false },
};

export default async function ProfileEditPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/signin?next=/profile/me/edit');
  if (!profile.username) redirect('/signup?next=/profile/me/edit');

  const displayName = profile.display_name ?? '';
  const bio = profile.bio ?? '';
  const initials = (profile.display_name ?? profile.username ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-bold">Edit profile</h1>
        <p className="mt-1 text-sm text-gray-400">@{profile.username}</p>

        {/* Avatar — initials only in V1 */}
        <div className="mt-8 flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-ash bg-smoke text-2xl font-semibold text-gray-300">
            {initials || '?'}
          </div>
          <div>
            <p className="text-sm font-medium">Avatar</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Initials only for now — photo upload coming soon.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <ProfileEditForm
            initialDisplayName={displayName}
            initialBio={bio}
            username={profile.username}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
