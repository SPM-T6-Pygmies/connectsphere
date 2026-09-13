import type { EventRequestStatus } from "@/core/domain/event-request";

export function isCoordinatorAssignmentAllowed(status: EventRequestStatus): boolean {
  return status !== "Draft" && status !== "Withdrawn" && status !== "Rejected";
}

/**
 * Assignment needs a selection; reassignment additionally needs a different
 * selection. The use case remains the authority when the form is submitted.
 */
export function canSubmitCoordinatorAssignment(params: {
  currentCoordinatorUserAccountId: string | null;
  selectedCoordinatorUserAccountId: string;
  status: EventRequestStatus;
}): boolean {
  return (
    isCoordinatorAssignmentAllowed(params.status) &&
    params.selectedCoordinatorUserAccountId.length > 0 &&
    params.selectedCoordinatorUserAccountId !== params.currentCoordinatorUserAccountId
  );
}
