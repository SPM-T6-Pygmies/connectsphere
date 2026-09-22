"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { confirmEventAction, type ConfirmEventState } from "../../actions";

const INITIAL: ConfirmEventState = { status: "idle" };

/**
 * SPM-50: confirms the event this Coordinator is viewing.
 *
 * `canConfirm` disables the button using the same read the page already
 * rendered its readiness list from -- an error here means something changed
 * between that read and this submit, not the first the coordinator hears of
 * what's missing.
 */
export function ConfirmForm({ eventId, canConfirm }: { eventId: string; canConfirm: boolean }) {
  const [state, formAction, pending] = useActionState(confirmEventAction, INITIAL);

  if (state.status === "confirmed") {
    return null;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={eventId} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={!canConfirm || pending}>
        Confirm event
      </Button>
    </form>
  );
}
