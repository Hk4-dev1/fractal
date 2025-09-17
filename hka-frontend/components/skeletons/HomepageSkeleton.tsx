import { Skeleton } from '../ui/skeleton';

export function HomepageSkeleton() {
  return (
  <div className="space-y-4 animate-pulse">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

export default HomepageSkeleton;
