import type { Metadata } from 'next';
import { Inter, Archivo_Black, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'c-roll — fan footage from every live event',
    template: '%s | c-roll',
  },
  description:
    'Fan-shot photos and videos from concerts, games, and live events. Relive the show.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'c-roll',
    title: 'c-roll — fan footage from every live event',
    description: 'Fan-shot photos and videos from concerts, games, and live events. Relive the show.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'c-roll — fan footage from every live event',
    description: 'Fan-shot photos and videos from concerts, games, and live events.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`bg-white ${inter.variable} ${archivoBlack.variable} ${bricolage.variable}`}>
      <body className="min-h-screen bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
