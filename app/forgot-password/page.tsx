import { Nav } from '@/components/nav';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-gray-400">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-sm text-gray-400">
          Remember it?{' '}
          <a href="/signin" className="text-white underline">
            Sign in
          </a>
        </p>
      </main>
    </div>
  );
}
