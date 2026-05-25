// /upload — entry point with no preselected event. The UploadFlow client
// component starts on the event-picker step.

import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { UploadFlow } from './upload-flow';

export const metadata: Metadata = {
  title: 'Upload',
  description: 'Add your photos and videos to a show on Showside.',
};

export default function UploadIndexPage() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <UploadFlow initialEvent={null} />
      </main>
    </div>
  );
}
