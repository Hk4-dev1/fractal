import { Skeleton } from '../ui/skeleton';

export function SidebarSkeleton() {
  return (
    <div className="w-[240px] p-3 space-y-3 animate-pulse">
      <Skeleton className="h-8 w-24" />
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export default SidebarSkeleton;
