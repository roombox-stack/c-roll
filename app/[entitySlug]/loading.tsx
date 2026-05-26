import { SkeletonBox, SkeletonText, SkeletonHeroGrid, SkeletonMediaGrid } from '@/components/skeleton';

export default function EntityLoading() {
  return (
    <div className="min-h-screen bg-ink text-white">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-ash bg-smoke/80" />

      {/* Hero */}
      <section className="border-b border-ash">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_540px] lg:py-16">
          <div className="space-y-4">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-12 w-64 md:w-96" />
            <SkeletonText className="h-4 w-48" />
            <SkeletonBox className="mt-2 h-9 w-32" />
          </div>
          <SkeletonHeroGrid />
        </div>
      </section>

      {/* Stats strip */}
      <div className="border-b border-ash bg-smoke/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-ash md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-6 text-center md:py-8">
              <SkeletonText className="mx-auto h-8 w-16" />
              <SkeletonText className="mx-auto mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        {/* Fan highlights */}
        <section>
          <SkeletonText className="h-7 w-40" />
          <div className="mt-4 flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBox key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
          <div className="mt-5">
            <SkeletonMediaGrid count={5} />
          </div>
        </section>

        {/* Recent shows */}
        <section>
          <SkeletonText className="h-7 w-32" />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBox key={i} className="aspect-[5/4]" />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
