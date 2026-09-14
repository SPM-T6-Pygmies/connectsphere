"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { decideEventRequestAction, type DecideEventRequestState } from "./actions";

const INITIAL: DecideEventRequestState = { status: "idle" };

/**
 * SPM-34: approve or reject the request this Coordinator is reviewing.
 *
 * One form, two submit buttons: React puts the pressed button's `name` and
 * `value` into the FormData, so neither button may carry a `formAction` of
 * its own (that drops the value). On success the page re-renders without
 * this form -- the outcome is shown by the server, not here.
 */
export function DecisionForm({ eventRequestId }: { eventRequestId: string }) {
  const [state, formAction, pending] = useActionState(decideEventRequestAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={eventRequestId} />

      <div className="space-y-2">
        <Label htmlFor="decisionRecord">Reason</Label>
        <Textarea
          id="decisionRecord"
          name="decisionRecord"
          // React resets the form after every action; a refused decision
          // re-seeds what was typed rather than losing it.
          defaultValue={state.status === "error" ? state.decisionRecord : ""}
          aria-describedby="decisionRecord-hint"
          disabled={pending}
        />
        <p id="decisionRecord-hint" className="text-muted-foreground text-xs">
          Required to reject. Optional when approving.
        </p>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          name="decision"
          value="approve"
          className="flex-1"
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="destructive"
          className="flex-1"
          disabled={pending}
        >
          Reject
        </Button>
      </div>
    </form>
  );
}
