import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { RequestForm } from './request-form';

export const metadata: Metadata = {
  title: 'Request content — c-roll',
  alternates: { canonical: '/request' },
};

export default function RequestPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
        <h1 className="text-4xl font-bold">Request content</h1>
        <p className="mt-3 text-gray-400">
          Don't see your artist, team, or show? Let us know and we'll add it.
        </p>
        <div className="mt-10">
          <RequestForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
