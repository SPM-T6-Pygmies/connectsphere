"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { markEquipmentLineUnfulfilledAction, reserveEquipmentLineAction, type EquipmentFormState } from "./actions";

const INITIAL: EquipmentFormState = { status: "idle" };

export interface DecidableLine {
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly quantityRequested: number;
  /** Null while the event has no date. */
  readonly available: number | null;
}

function Message({ state }: { state: EquipmentFormState }) {
  if (state.status === "error") {
    return (
      <p role="alert" className="text-destructive text-xs">
        {state.message}
      </p>
    );
  }
  return null;
}

/**
 * SPM-274: what Technical Support can do with a line awaiting a decision.
 * With enough free, reserve it in full (AC1); with too few, mark it
 * unfulfilled with a comment (AC3); with no date, nothing yet (AC2). The
 * server judges what is free again when they act (AC6) and, if that changed,
 * says so here as the page refreshes to show the other choice.
 */
export function EquipmentLineDecision({ eventId, line }: { eventId: string; line: DecidableLine }) {
  const [reserveState, reserveAction, reserving] = useActionState(reserveEquipmentLineAction, INITIAL);
  const [markState, markAction, marking] = useActionState(markEquipmentLineUnfulfilledAction, INITIAL);

  if (line.available === null) {
    return <p className="text-muted-foreground text-xs">Needs a date before equipment can be reserved.</p>;
  }

  const enough = line.available >= line.quantityRequested;
  const ids = (
    <>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="equipmentItemId" value={line.equipmentItemId} />
    </>
  );

  return (
    <div className="grid gap-1.5">
      <Message state={reserveState} />
      {enough ? (
        <form action={reserveAction}>
          {ids}
          <Button type="submit" size="sm" className="h-7" disabled={reserving}>
            {reserving ? "Reserving…" : `Reserve ${line.quantityRequested}`}
          </Button>
        </form>
      ) : (
        <form action={markAction} className="grid gap-1.5">
          {ids}
          <Textarea
            name="comment"
            rows={2}
            aria-label={`Why ${line.equipmentType} cannot be fulfilled`}
            placeholder={`e.g. only ${Math.max(line.available, 0)} available`}
            defaultValue={markState.status === "error" ? markState.values?.comment : undefined}
            className="min-h-14 text-sm"
            disabled={marking}
          />
          <Message state={markState} />
          <Button type="submit" size="sm" variant="outline" className="h-7 justify-self-start" disabled={marking}>
            {marking ? "Saving…" : "Mark unfulfilled"}
          </Button>
        </form>
      )}
    </div>
  );
}
