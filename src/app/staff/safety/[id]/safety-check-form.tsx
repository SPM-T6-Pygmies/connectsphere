"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { recordSafetyCheckAction, type RecordSafetyCheckState } from "./actions";

const INITIAL: RecordSafetyCheckState = { status: "idle" };

/**
 * SPM-260: approve or reject the event the Safety Officer is reviewing.
 *
 * One form, two submit buttons, as Venue Staff's decision form does: the
 * pressed button's `name` and `value` reach the FormData. On success the page
 * re-renders showing the outcome in the history, and the form is gone.
 */
export function SafetyCheckForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(recordSafetyCheckAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />

      <div className="space-y-1.5">
        <Label htmlFor="safetyComments">Comments</Label>
        <Textarea
          id="safetyComments"
          name="comments"
          // React resets the form after every action; a refused outcome
          // re-seeds what was typed rather than losing it.
          defaultValue={state.status === "error" ? state.comments : ""}
          placeholder="Required if you reject — say which arrangements must change and why."
          disabled={pending}
        />
        <p className="text-muted-foreground text-xs">
          Optional if you approve, for example notes on emergency access or crowd movement.
        </p>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="outcome" value="Approved" disabled={pending}>
          Approve
        </Button>
        <Button type="submit" name="outcome" value="Rejected" variant="destructive" disabled={pending}>
          Reject
        </Button>
      </div>
    </form>
  );
}
