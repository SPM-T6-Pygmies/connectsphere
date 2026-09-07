import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-8 h-9 w-full" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
