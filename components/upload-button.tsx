// Persistent "Upload your photos & videos" CTA.
//   Mobile: full-width sticky button at the bottom of the viewport.
//   Desktop: floating pill in the bottom-right corner.

import Link from 'next/link';

export function UploadButton({ eventSlug }: { eventSlug?: string }) {
  const href = eventSlug ? `/upload/${eventSlug}` : '/upload';
  return (
    <>
      {/* Mobile: stuck to bottom edge, full width. Body should add
          padding-bottom so content isn't hidden behind it. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ash bg-ink/95 p-3 backdrop-blur md:hidden">
        <Link
          href={href}
          className="block w-full rounded-full bg-white py-3 text-center text-sm font-medium text-ink hover:bg-gray-200"
        >
          Upload your photos &amp; videos
        </Link>
      </div>

      {/* Desktop: floating pill bottom-right. */}
      <Link
        href={href}
        className="fixed bottom-6 right-6 z-30 hidden rounded-full bg-white px-5 py-3 text-sm font-medium text-ink shadow-lg hover:bg-gray-200 md:inline-flex"
      >
        Upload your photos &amp; videos
      </Link>
    </>
  );
}
