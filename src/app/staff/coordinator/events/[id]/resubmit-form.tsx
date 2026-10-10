"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { resubmitForSafetyCheckAction, type ResubmitForSafetyCheckState } from "../../actions";

const INITIAL: ResubmitForSafetyCheckState = { status: "idle" };

/** SPM-261 AC3: sends the rejected event back for a fresh safety check. */
export function ResubmitForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(resubmitForSafetyCheckAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        Resubmit for safety check
      </Button>
    </form>
  );
}
