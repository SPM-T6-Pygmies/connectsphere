"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { clearBookingFlagAction, type ClearBookingFlagState } from "./actions";

const INITIAL: ClearBookingFlagState = { status: "idle" };

/**
 * SPM-310: the coordinator decides the flagged booking still fits and clears its flag,
 * every reason at once, so they need not re-request a venue that works. The first press
 * asks before anything is sent. Clearing removes the badge, which unmounts this form, so
 * the confirmation is a toast fired from the action.
 */
export function ClearFlagForm({
  eventId,
  eventRequestId,
  bookingId,
  venueLocation,
}: {
  eventId: string;
  eventRequestId: string;
  bookingId: string;
  venueLocation: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: ClearBookingFlagState, formData: FormData) => {
      const next = await clearBookingFlagAction(previous, formData);
      if (next.status === "cleared") {
        toast.success(`Flag cleared on ${next.venueLocation}. The booking stays ${next.bookingStatus}.`);
      }
      return next;
    },
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Clear flag
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventRequestId" value={eventRequestId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-xs">
        Keep {venueLocation} as it is and clear every reason above? Do this only if the booking
        still suits the event.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Clearing…" : "Yes, clear flag"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep flag
        </Button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-xs">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
