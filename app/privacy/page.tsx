import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Showside',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  const updated = 'May 2025';
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {updated}</p>

        <div className="prose prose-invert mt-10 max-w-none space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Information we collect</h2>
            <p>
              <strong className="text-white">Anonymous uploads:</strong> When you upload without
              an account, we store an anonymous session token in your browser's local storage.
              This token is not linked to any personally identifiable information.
            </p>
            <p className="mt-3">
              <strong className="text-white">Account registration:</strong> If you create an
              account we collect your email address and the username you choose. We do not
              require a real name.
            </p>
            <p className="mt-3">
              <strong className="text-white">Uploaded content:</strong> Photos and videos you
              upload are stored on our servers and made publicly visible as part of the
              show archive. Metadata you provide (song tags, section tags, captions) is stored
              alongside your upload.
            </p>
            <p className="mt-3">
              <strong className="text-white">Usage data:</strong> We collect standard server
              logs including IP addresses, browser type, and pages visited. We use this data
              to operate and improve the service, not to identify individual users.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">How we use your information</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>To display your uploaded content as part of event archives.</li>
              <li>To maintain your account and show contribution history if you register.</li>
              <li>To respond to support requests and DMCA notices.</li>
              <li>To improve the platform and diagnose technical issues.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Cookies and local storage</h2>
            <p>
              We use a single anonymous session token stored in your browser's local storage.
              This token deduplicates likes and view counts but is not used for advertising
              or tracking across sites. We do not use third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Content removal</h2>
            <p>
              You may request removal of your uploaded content at any time by contacting us
              via the{' '}
              <a href="/contact" className="text-white underline hover:no-underline">contact form</a>.
              For copyright-related removal requests, please use our{' '}
              <a href="/dmca" className="text-white underline hover:no-underline">DMCA page</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Data retention</h2>
            <p>
              Uploaded media is retained indefinitely as part of the live event archive.
              Account data is retained while your account is active. You may request deletion
              of your account and associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Contact</h2>
            <p>
              Questions about this policy? Reach us via the{' '}
              <a href="/contact" className="text-white underline hover:no-underline">contact form</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
