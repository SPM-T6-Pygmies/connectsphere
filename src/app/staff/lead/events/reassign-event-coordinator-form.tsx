"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import type { EventCoordinatorDetails } from "@/core/use-cases/view-all-event-coordinators";

import { reassignEventCoordinatorAction, type ReassignEventCoordinatorState } from "../actions";
import { canSubmitCoordinatorAssignment } from "../assignment-selection";

const INITIAL: ReassignEventCoordinatorState = { status: "idle" };

/** SPM-257: pick another coordinator for an active event. No acceptance step follows. */
export function ReassignEventCoordinatorForm({
  eventId,
  eventName,
  eventStatus,
  currentCoordinatorUserAccountId,
  reassignmentAllowed,
  eventCoordinators,
}: {
  eventId: string;
  eventName: string;
  eventStatus: CoordinatorEventStatus;
  currentCoordinatorUserAccountId: string | null;
  /** Whether the event's coordinator can change at all -- the domain's answer, from the use case. */
  reassignmentAllowed: boolean;
  eventCoordinators: readonly EventCoordinatorDetails[];
}) {
  const [state, formAction, pending] = useActionState(reassignEventCoordinatorAction, INITIAL);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState(
    currentCoordinatorUserAccountId ?? "",
  );

  const storedCoordinatorId =
    state.status === "success" ? state.assignedCoordinatorUserAccountId : currentCoordinatorUserAccountId;
  const canSubmit = canSubmitCoordinatorAssignment({
    assignmentAllowed: reassignmentAllowed,
    currentCoordinatorUserAccountId: storedCoordinatorId,
    selectedCoordinatorUserAccountId: selectedCoordinatorId,
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />

      <fieldset className="space-y-2" disabled={pending || !reassignmentAllowed}>
        <legend className="sr-only">Event Coordinator</legend>
        {eventCoordinators.map((coordinator) => (
          <label
            key={coordinator.userAccountId}
            className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          >
            <input
              type="radio"
              name="eventCoordinatorUserAccountId"
              value={coordinator.userAccountId}
              defaultChecked={coordinator.userAccountId === currentCoordinatorUserAccountId}
              onChange={() => setSelectedCoordinatorId(coordinator.userAccountId)}
              className="mt-1"
            />
            <span className="min-w-0 flex-1 text-sm font-medium">{coordinator.name}</span>
            {coordinator.userAccountId === storedCoordinatorId ? (
              <span className="text-muted-foreground text-xs">Current</span>
            ) : null}
          </label>
        ))}
      </fieldset>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Reassignment was not successful</AlertTitle>
        </Alert>
      ) : null}

      {state.status === "success" ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertTitle>{eventName} has been reassigned</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={!canSubmit || pending}>
        {pending ? "Reassigning…" : "Reassign"}
      </Button>

      <p className="text-muted-foreground text-xs">
        {!reassignmentAllowed
          ? `A ${eventStatus} event's coordinator cannot change.`
          : "The new coordinator takes over at once and is notified, as is the Organiser."}
      </p>
    </form>
  );
}
