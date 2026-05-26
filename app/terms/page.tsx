import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Showside',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  const updated = 'May 2025';
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {updated}</p>

        <div className="mt-10 space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">1. Acceptance</h2>
            <p>
              By using Showside you agree to these terms. If you do not agree, please do not
              use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">2. Uploaded content</h2>
            <p>
              You retain ownership of content you upload. By uploading, you grant Showside a
              worldwide, non-exclusive, royalty-free license to store, display, and distribute
              your content as part of the platform. You represent that you own or have the right
              to upload the content, and that it does not infringe any third-party rights.
            </p>
            <p className="mt-3">
              You may not upload content that is illegal, defamatory, or sexually explicit.
              Showside reserves the right to remove any content at its discretion.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">3. Prohibited uses</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Uploading content you do not have the right to share.</li>
              <li>Attempting to scrape, reverse-engineer, or disrupt the service.</li>
              <li>Creating accounts for spam or automated abuse.</li>
              <li>Uploading malware, phishing content, or illegal material.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">4. Copyright</h2>
            <p>
              Showside respects intellectual property rights. If you believe content on
              Showside infringes your copyright, please submit a notice via our{' '}
              <a href="/dmca" className="text-white underline hover:no-underline">DMCA page</a>.
              We will respond and remove infringing content as required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">5. Disclaimer of warranties</h2>
            <p>
              Showside is provided "as is" without warranties of any kind. We do not guarantee
              uptime, accuracy of content, or fitness for any particular purpose. Fan-uploaded
              content represents the views of individual uploaders, not Showside.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">6. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Showside is not liable for any indirect,
              incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">7. Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">8. Contact</h2>
            <p>
              Questions about these terms? Reach us via the{' '}
              <a href="/contact" className="text-white underline hover:no-underline">contact form</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
