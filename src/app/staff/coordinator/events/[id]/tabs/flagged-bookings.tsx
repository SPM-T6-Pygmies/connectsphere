import { FlagIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";

import { formatHoldExpiry } from "../../../../hold-expiry";
import { FlagReasons } from "../../../flag-reasons";
import { StatusBadge } from "../../../../status-badge";

/** One booking and every open reason it is flagged for, in the order they were raised. */
function groupByBooking(flags: readonly EventBookingFlag[]): ReadonlyArray<readonly EventBookingFlag[]> {
  const groups = new Map<string, EventBookingFlag[]>();
  for (const flag of flags) {
    groups.set(flag.bookingId, [...(groups.get(flag.bookingId) ?? []), flag]);
  }
  return [...groups.values()];
}

/**
 * SPM-313 AC4: the venue bookings of this event that something has changed under,
 * each with its reasons and when it was flagged. A flag is a marker to look at: the
 * booking's status is shown as it is, and nothing here changes it. Clearing a flag
 * or asking for another venue come with SPM-310 and SPM-251.
 */
export function FlaggedBookings({ flags }: { flags: readonly EventBookingFlag[] }) {
  if (flags.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="flagged-bookings-heading" className="space-y-3">
      <h3 id="flagged-bookings-heading" className="text-sm font-semibold">
        Flagged for review
      </h3>
      <p className="text-muted-foreground text-sm">
        Something changed under these bookings. They keep their status and nothing has been
        cancelled; arrange another venue or confirm the booking still suits.
      </p>
      {groupByBooking(flags).map(([first, ...rest]) => (
        <Alert key={first.bookingId} data-testid={`flagged-booking-${first.bookingId}`}>
          <FlagIcon aria-hidden />
          <AlertTitle className="flex flex-wrap items-center gap-2">
            <span>{first.venueLocation}</span>
            <span className="text-muted-foreground font-normal">{first.bookedFor}</span>
            <StatusBadge status={first.status} />
            {first.holdExpiresAt === null ? null : (
              <span className="text-muted-foreground font-normal">
                On hold until {formatHoldExpiry(first.holdExpiresAt)}
              </span>
            )}
          </AlertTitle>
          <AlertDescription>
            <FlagReasons flags={[first, ...rest]} />
          </AlertDescription>
        </Alert>
      ))}
    </section>
  );
}
