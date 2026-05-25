// /signin — email + password form.

import { Nav } from '@/components/nav';
import { SigninForm } from './signin-form';

export const metadata = {
  title: 'Sign in',
};

export default function SigninPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-400">Sign in to continue.</p>
        <div className="mt-6">
          <SigninForm next={searchParams.next} />
        </div>
        <p className="mt-6 text-sm text-gray-400">
          New here?{' '}
          <a
            href={`/signup${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''}`}
            className="text-white underline"
          >
            Create an account
          </a>
        </p>
      </main>
    </div>
  );
}
