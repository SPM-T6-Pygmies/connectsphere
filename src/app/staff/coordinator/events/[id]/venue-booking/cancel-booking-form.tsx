"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { cancelVenueBookingAction, type CancelVenueBookingState } from "./actions";

const INITIAL: CancelVenueBookingState = { status: "idle" };

/**
 * SPM-20: cancel a booking and free its slots for other coordinators. Offered
 * only for a booking that still holds, or may yet hold, its slots; the server
 * makes every call, this only keeps the button honest. Cancelling cannot be
 * undone, so the first press asks before anything is sent.
 *
 * The row stops offering this once the booking is Released, which unmounts
 * the form -- so the confirmation is a toast fired from the action.
 */
export function CancelBookingForm({
  eventId,
  bookingId,
  venueLocation,
}: {
  eventId: string;
  bookingId: string;
  venueLocation: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: CancelVenueBookingState, formData: FormData) => {
      const next = await cancelVenueBookingAction(previous, formData);
      if (next.status === "cancelled") {
        toast.success(`Booking at ${next.venueLocation} cancelled. Its slots are free again.`);
      }
      return next;
    },
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Cancel booking
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-xs">Release {venueLocation} for this event? This cannot be undone.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? "Cancelling…" : "Yes, cancel booking"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep booking
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
