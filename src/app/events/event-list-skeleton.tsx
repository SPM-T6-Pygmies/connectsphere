import { Skeleton } from "@/components/ui/skeleton";

export function EventListSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
