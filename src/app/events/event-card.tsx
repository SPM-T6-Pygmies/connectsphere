import { Clock, MapPin } from "lucide-react";
import Link from "next/link";

import type { AvailableEvent } from "@/core/ports/inbound/available-event";

import { timeRange } from "./format-event-time";

/**
 * One event in the list. The whole row is the link, so the tap target on a
 * phone is the row rather than the title (brief s7: mobile-friendly).
 */
export function EventCard({ event }: { event: AvailableEvent }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="hover:bg-accent/50 focus-visible:ring-ring block rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-base leading-snug font-semibold text-balance">{event.name}</h3>

        <dl className="text-muted-foreground mt-2 space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Starts</dt>
            <Clock aria-hidden className="size-3.5 shrink-0" />
            <dd>{timeRange(event.startsAt, event.endsAt)}</dd>
          </div>
          {event.venueName ? (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Venue</dt>
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <dd className="truncate">{event.venueName}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </Link>
  );
}
