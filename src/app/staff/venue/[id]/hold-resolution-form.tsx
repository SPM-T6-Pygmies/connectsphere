"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { decideBookingRequestAction, type DecideBookingRequestState } from "./actions";

const INITIAL: DecideBookingRequestState = { status: "idle" };

/**
 * SPM-219: confirm or release a live hold.
 *
 * Confirming commits the held slots to the event; releasing frees them at once.
 * Neither needs a note. A hold that expired, or was decided, while the page was
 * open comes back as a message and nothing changes. On success the page
 * re-renders showing the outcome.
 */
export function HoldResolutionForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(decideBookingRequestAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="confirm" disabled={pending}>
          Confirm hold
        </Button>
        <Button type="submit" name="decision" value="release" variant="outline" disabled={pending}>
          Release hold
        </Button>
      </div>
    </form>
  );
}
