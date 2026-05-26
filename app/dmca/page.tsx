import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { DmcaForm } from './dmca-form';

export const metadata: Metadata = {
  title: 'DMCA Takedown — Showside',
  alternates: { canonical: '/dmca' },
};

export default function DmcaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-4xl font-bold">DMCA Takedown Policy</h1>

        <div className="mt-8 space-y-6 text-gray-300 leading-relaxed">
          <p>
            Showside respects intellectual property rights and complies with the Digital
            Millennium Copyright Act (DMCA). If you believe content hosted on Showside
            infringes your copyright, you may submit a takedown notice below.
          </p>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">What to include</h2>
            <ul className="list-inside list-disc space-y-2 text-sm">
              <li>The URL of the specific content you believe infringes your copyright.</li>
              <li>A description of the copyrighted work you claim has been infringed.</li>
              <li>Your contact email so we can respond to your notice.</li>
              <li>
                A statement that you have a good-faith belief that the use is not authorized
                by the copyright owner, its agent, or the law.
              </li>
              <li>
                A statement that the information in your notice is accurate, and under penalty
                of perjury, that you are authorized to act on behalf of the copyright owner.
              </li>
            </ul>
          </section>

          <p className="text-sm text-gray-400">
            We review all notices promptly and remove infringing content when required. False
            DMCA claims may expose you to liability under 17 U.S.C. § 512(f).
          </p>
        </div>

        <div className="mt-12 rounded-lg border border-ash bg-smoke p-6">
          <h2 className="mb-6 text-xl font-semibold">Submit a takedown request</h2>
          <DmcaForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
