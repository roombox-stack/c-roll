// /signup — email + password + username form.
// Honors ?next=<path> for post-signup redirect.
// Honors ?attend=<eventId> to auto-toggle attendance once signed in.

import { Nav } from '@/components/nav';
import { SignupForm } from './signup-form';

export const metadata = {
  title: 'Sign up',
  description: 'Create a Showside account to track shows and get credited for uploads.',
};

export default function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string; attend?: string };
}) {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-gray-400">
          Track shows you&apos;ve been to and get credited for your uploads.
        </p>
        <div className="mt-6">
          <SignupForm next={searchParams.next} attendEventId={searchParams.attend} />
        </div>
        <p className="mt-6 text-sm text-gray-400">
          Already have an account?{' '}
          <a href={`/signin${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''}`} className="text-white underline">
            Sign in
          </a>
        </p>
      </main>
    </div>
  );
}
