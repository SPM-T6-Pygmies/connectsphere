"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { EventRequestStatus } from "@/core/domain/event-request";
import type { EventCoordinatorDetails } from "@/core/use-cases/view-all-event-coordinators";

import {
  assignEventCoordinatorAction,
  type AssignEventCoordinatorState,
} from "./actions";
import {
  canSubmitCoordinatorAssignment,
  isCoordinatorAssignmentAllowed,
} from "./assignment-selection";

const INITIAL: AssignEventCoordinatorState = { status: "idle" };

function coordinatorMeta(coordinator: EventCoordinatorDetails): string {
  return (
    [coordinator.department, coordinator.availability].filter(Boolean).join(" · ") ||
    "No availability details supplied"
  );
}

export function AssignEventCoordinatorForm({
  eventRequestId,
  eventRequestName,
  currentCoordinatorUserAccountId,
  eventRequestStatus,
  eventCoordinators,
}: {
  eventRequestId: string;
  eventRequestName: string;
  currentCoordinatorUserAccountId: string | null;
  eventRequestStatus: EventRequestStatus;
  eventCoordinators: readonly EventCoordinatorDetails[];
}) {
  const [state, formAction, pending] = useActionState(
    assignEventCoordinatorAction,
    INITIAL,
  );
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState(
    currentCoordinatorUserAccountId ?? "",
  );

  const storedCoordinatorId =
    state.status === "success"
      ? state.assignedCoordinatorUserAccountId
      : currentCoordinatorUserAccountId;
  const assignmentAllowed = isCoordinatorAssignmentAllowed(eventRequestStatus);
  const canSubmit = canSubmitCoordinatorAssignment({
    currentCoordinatorUserAccountId: storedCoordinatorId,
    selectedCoordinatorUserAccountId: selectedCoordinatorId,
    status: eventRequestStatus,
  });
  const isReassignment = storedCoordinatorId !== null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventRequestId" value={eventRequestId} />
      <input
        type="hidden"
        name="assignmentOperation"
        value={isReassignment ? "reassigned" : "assigned"}
      />

      <fieldset
        key={
          state.status === "success"
            ? `assigned-${state.assignedCoordinatorUserAccountId}`
            : "assignment-selector"
        }
        className="space-y-2"
        disabled={pending || !assignmentAllowed}
      >
        <legend className="sr-only">Event Coordinator</legend>
        {eventCoordinators.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            No Event Coordinators are available.
          </p>
        ) : (
          eventCoordinators.map((coordinator) => {
            const selected = selectedCoordinatorId === coordinator.userAccountId;

            return (
              <label
                key={coordinator.userAccountId}
                className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input
                  type="radio"
                  name="eventCoordinatorUserAccountId"
                  value={coordinator.userAccountId}
                  defaultChecked={selected}
                  onChange={() => setSelectedCoordinatorId(coordinator.userAccountId)}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{coordinator.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {coordinatorMeta(coordinator)}
                  </span>
                </span>
                {coordinator.userAccountId === storedCoordinatorId ? (
                  <span className="text-muted-foreground text-xs">Current</span>
                ) : null}
              </label>
            );
          })
        )}
      </fieldset>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Assignment/reassignment was not successful</AlertTitle>
        </Alert>
      ) : null}

      {state.status === "success" ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertTitle>
            {eventRequestName} has been {state.operation}
          </AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={!canSubmit || pending}>
        {pending
          ? isReassignment
            ? "Reassigning…"
            : "Assigning…"
          : isReassignment
            ? "Reassign"
            : "Assign coordinator"}
      </Button>

      <p className="text-muted-foreground text-xs">
        {!assignmentAllowed
          ? `${eventRequestStatus} requests cannot be assigned.`
          : eventCoordinators.length === 0
            ? "Add an Event Coordinator before assigning this request."
            : isReassignment && selectedCoordinatorId === storedCoordinatorId
              ? "Select a different coordinator to reassign this request."
              : selectedCoordinatorId.length === 0
                ? "Select a coordinator to continue."
                : "The selected coordinator will become responsible for this request."}
      </p>
    </form>
  );
}
