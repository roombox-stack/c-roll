import { SkeletonBox, SkeletonText, SkeletonMediaGrid } from '@/components/skeleton';

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-ink text-white">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-ash bg-smoke/80" />

      {/* Profile header */}
      <section className="border-b border-ash bg-smoke/40">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <SkeletonBox className="h-20 w-20 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <SkeletonText className="h-7 w-40" />
              <SkeletonText className="h-4 w-24" />
              <SkeletonText className="h-4 w-64" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="border-b border-ash">
        <div className="mx-auto grid max-w-4xl grid-cols-2 divide-x divide-ash md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 text-center">
              <SkeletonText className="mx-auto h-8 w-12" />
              <SkeletonText className="mx-auto mt-2 h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        {/* Shows section */}
        <section>
          <SkeletonText className="h-6 w-36" />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBox key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </section>

        {/* Uploads section */}
        <section>
          <SkeletonText className="h-6 w-28" />
          <div className="mt-4">
            <SkeletonMediaGrid count={8} />
          </div>
        </section>
      </main>
    </div>
  );
}
