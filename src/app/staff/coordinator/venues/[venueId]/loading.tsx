import { Skeleton } from "@/components/ui/skeleton";

/** SPM-155: shown while a week of the calendar is read. */
export default function Loading() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading the venue calendar">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
