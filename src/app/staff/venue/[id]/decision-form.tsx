"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { decideBookingRequestAction, type DecideBookingRequestState } from "./actions";

const INITIAL: DecideBookingRequestState = { status: "idle" };

/**
 * SPM-22: approve or reject the booking request Venue Staff are reviewing.
 *
 * One form, two submit buttons, as the coordinator's decision form does: the
 * pressed button's `name` and `value` reach the FormData, so neither carries a
 * `formAction`. "Hold tentatively" is not offered here -- it belongs to
 * SPM-218 and SPM-219. On success the page re-renders showing the outcome.
 */
export function DecisionForm({
  bookingId,
  alternatives,
}: {
  bookingId: string;
  alternatives: ReadonlyArray<{ id: string; location: string; capacity: number | null }>;
}) {
  const [state, formAction, pending] = useActionState(decideBookingRequestAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />

      <div className="space-y-1.5">
        <Label htmlFor="decisionNote">Note to the coordinator</Label>
        <Textarea
          id="decisionNote"
          name="note"
          // React resets the form after every action; a refused decision
          // re-seeds what was typed rather than losing it.
          defaultValue={state.status === "error" ? state.note : ""}
          placeholder="Required if you reject — say why, so the coordinator can act on it."
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="alternativeVenue">Suggest an alternative (optional)</Label>
        <select
          id="alternativeVenue"
          name="alternative"
          defaultValue={state.status === "error" ? state.alternative : ""}
          disabled={pending}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3"
        >
          <option value="">No suggestion</option>
          {alternatives.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.location}
              {candidate.capacity === null ? "" : ` (holds ${candidate.capacity})`}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          A suggestion is informal. It does not create a booking — the coordinator raises the new
          request. It is kept only if you reject.
        </p>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          Approve booking
        </Button>
        <Button type="submit" name="decision" value="reject" variant="destructive" disabled={pending}>
          Reject
        </Button>
      </div>
    </form>
  );
}
