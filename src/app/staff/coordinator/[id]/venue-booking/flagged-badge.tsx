"use client";

import { FlagIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";

import { FlagReasons } from "../../flag-reasons";

/**
 * SPM-313 AC4: a booking something has changed under shows a "Flagged" badge beside its
 * status. Hovering, focusing or clicking it opens the reasons, so the coordinator reads
 * them in the list they already manage bookings from. Clearing the flag (SPM-310) and
 * asking for another venue (SPM-251) are added to this card by those tickets.
 */
export function FlaggedBadge({ flags }: { flags: readonly EventBookingFlag[] }) {
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
      </PopoverContent>
    </Popover>
  );
}
