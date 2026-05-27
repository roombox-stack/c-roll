import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact — c-roll',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
        <h1 className="text-4xl font-bold">Get in touch</h1>
        <p className="mt-3 text-gray-400">
          Questions, feedback, or content removal requests. We read everything.
        </p>

        <div className="mt-10 rounded-lg border border-ash bg-smoke p-6">
          <ContactForm />
        </div>

        <div className="mt-8 space-y-2 text-sm text-gray-500">
          <p>
            For copyright-related takedowns, use the{' '}
            <a href="/dmca" className="text-gray-300 underline hover:text-white">DMCA form</a>.
          </p>
          <p>
            For business inquiries, artist dashboards, or partnership opportunities,
            mention that in your message.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
