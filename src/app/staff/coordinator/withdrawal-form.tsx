"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { withdrawEventRequestAction, type WithdrawEventRequestState } from "./actions";

const INITIAL: WithdrawEventRequestState = { status: "idle" };

/**
 * SPM-101: record a withdrawal the Organiser asked for outside the system
 * (#103). Kept apart from the approve/reject form, and behind a confirmation
 * step, because a withdrawal is final and is not the Coordinator's decision.
 * On success the page re-renders without this form.
 */
export function WithdrawalForm({ eventRequestId }: { eventRequestId: string }) {
  const [state, formAction, pending] = useActionState(withdrawEventRequestAction, INITIAL);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setConfirming(true)}>
        Record withdrawal
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={eventRequestId} />

      <div className="space-y-2">
        <Label htmlFor="withdrawal-note">Note</Label>
        <Textarea
          id="withdrawal-note"
          name="note"
          defaultValue={state.status === "error" ? state.note : ""}
          aria-describedby="withdrawal-note-hint"
          disabled={pending}
        />
        <p id="withdrawal-note-hint" className="text-muted-foreground text-xs">
          Optional. The request will be withdrawn and cannot be reopened.
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
          type="button"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button type="submit" variant="destructive" className="flex-1" disabled={pending}>
          {pending ? "Withdrawing…" : "Confirm withdrawal"}
        </Button>
      </div>
    </form>
  );
}
