// Reusable skeleton primitives — pulse-animated grey boxes used in loading.tsx files.

export function SkeletonBox({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`animate-pulse rounded bg-ash/60 ${className}`} />
  );
}

export function SkeletonText({
  className = '',
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded bg-ash/60 ${className}`} />;
}

// Media card skeleton (matches MediaCard aspect ratio).
export function SkeletonCard({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const aspect = size === 'sm' ? 'aspect-video' : 'aspect-video';
  return (
    <div className="overflow-hidden rounded-lg bg-smoke">
      <div className={`${aspect} animate-pulse bg-ash/60`} />
    </div>
  );
}

// 2×3 grid of skeleton cards — used in entity hero.
export function SkeletonHeroGrid() {
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-md bg-ash/60" />
      ))}
    </div>
  );
}

// Full media grid skeleton — 4 columns.
export function SkeletonMediaGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
