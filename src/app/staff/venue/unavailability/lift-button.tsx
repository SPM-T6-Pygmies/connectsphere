"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { liftUnavailabilityAction, type LiftUnavailabilityState } from "./actions";

const INITIAL: LiftUnavailabilityState = { status: "idle" };

/** SPM-21 AC15: lifts one block that is In force. Not rendered for a Lifted block (AC17). */
export function LiftButton({ unavailabilityId }: { unavailabilityId: string }) {
  const [state, formAction, pending] = useActionState(liftUnavailabilityAction, INITIAL);

  useEffect(() => {
    if (state.status === "lifted") {
      toast.success("Block lifted.");
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="unavailabilityId" value={unavailabilityId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Lifting…" : "Lift"}
      </Button>
    </form>
  );
}
