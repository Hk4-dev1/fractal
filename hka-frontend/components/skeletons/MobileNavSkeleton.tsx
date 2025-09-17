import { Skeleton } from '../ui/skeleton';

export function MobileNavSkeleton() {
  return (
  <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/60 backdrop-blur p-2 animate-pulse">
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}

export default MobileNavSkeleton;
