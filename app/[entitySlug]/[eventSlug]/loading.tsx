import { SkeletonBox, SkeletonText, SkeletonMediaGrid } from '@/components/skeleton';

export default function EventLoading() {
  return (
    <div className="min-h-screen bg-ink text-white">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-ash bg-smoke/80" />

      {/* Event header */}
      <section className="border-b border-ash bg-smoke">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <SkeletonText className="h-4 w-28" />
          <SkeletonText className="mt-3 h-9 w-72" />
          <SkeletonText className="mt-2 h-4 w-56" />

          <div className="mt-5 flex gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <SkeletonText className="h-8 w-12" />
                <SkeletonText className="mt-1 h-3 w-16" />
              </div>
            ))}
          </div>

          <SkeletonBox className="mt-5 h-9 w-36 rounded-full" />

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-ash pb-px">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBox key={i} className="h-9 w-20 rounded-none rounded-t" />
            ))}
          </div>
        </div>
      </section>

      {/* Content area */}
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-10">
        {/* Featured video placeholder */}
        <SkeletonBox className="aspect-video w-full max-w-4xl rounded-lg" />
        {/* Grid */}
        <SkeletonMediaGrid count={8} />
      </main>
    </div>
  );
}
