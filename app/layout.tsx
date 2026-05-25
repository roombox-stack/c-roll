import type { Metadata } from 'next';
import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Showside — fan footage from every live event',
    template: '%s | Showside',
  },
  description:
    'Fan-shot photos and videos from concerts, games, and live events. Relive the show.',
  openGraph: {
    type: 'website',
    siteName: 'Showside',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-ink">
      <body className="min-h-screen bg-ink text-white antialiased">{children}</body>
    </html>
  );
}
