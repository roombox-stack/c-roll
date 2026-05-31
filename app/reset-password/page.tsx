import { Nav } from '@/components/nav';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </main>
    </div>
  );
}
