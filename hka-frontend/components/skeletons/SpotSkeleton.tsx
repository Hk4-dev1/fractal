import { Skeleton } from '../ui/skeleton';

export function SpotSkeleton() {
  return (
  <div className="max-w-xl mx-auto space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-8" />
      </div>
      <div className="p-4 border rounded-lg space-y-3">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

export default SpotSkeleton;
