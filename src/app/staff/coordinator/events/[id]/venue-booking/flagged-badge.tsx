"use client";

import { FlagIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";

import { FlagReasons } from "../../../flag-reasons";
import { ClearFlagForm } from "./clear-flag-form";

/**
 * SPM-313 AC4: a booking something has changed under shows a "Flagged" badge beside its
 * status. Hovering, focusing or clicking it opens the reasons, so the coordinator reads
 * them in the list they already manage bookings from. The card also clears the flag when
 * the booking still fits (SPM-310), or opens the booking form to re-request a venue for it
 * (SPM-251) -- unless a re-request for it already waits for Venue Staff (AC9).
 */
export function FlaggedBadge({
  flags,
  eventId,
  reRequestWaiting,
}: {
  flags: readonly EventBookingFlag[];
  eventId: string;
  reRequestWaiting: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex"
          aria-label={`Flagged for review: ${flags.length} ${flags.length === 1 ? "reason" : "reasons"}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <Badge
            variant="outline"
            className="cursor-pointer gap-1 border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            <FlagIcon aria-hidden className="size-3" />
            Flagged
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 space-y-2"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="text-sm font-semibold">Flagged for review</p>
        <p className="text-muted-foreground text-xs">
          Something changed under this booking. It keeps its status and nothing has been cancelled.
        </p>
        <FlagReasons flags={flags} />
        {reRequestWaiting ? (
          <p className="text-muted-foreground text-xs">Re-request pending with Venue Staff.</p>
        ) : (
          <Button asChild size="sm">
            <Link
              href={`/staff/coordinator/events/${eventId}?tab=venue&replace=${flags[0].bookingId}#new-request`}
              onClick={() => setOpen(false)}
            >
              Re-request venue
            </Link>
          </Button>
        )}
        <ClearFlagForm
          eventId={eventId}
          bookingId={flags[0].bookingId}
          venueLocation={flags[0].venueLocation}
        />
      </PopoverContent>
    </Popover>
  );
}
