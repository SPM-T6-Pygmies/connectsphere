/**
 * Assignment needs a selection; reassignment additionally needs a different
 * selection. Whether the request can take a coordinator at all is the domain's
 * answer, passed in -- and the use case remains the authority when the form is
 * submitted.
 */
export function canSubmitCoordinatorAssignment(params: {
  assignmentAllowed: boolean;
  currentCoordinatorUserAccountId: string | null;
  selectedCoordinatorUserAccountId: string;
}): boolean {
  return (
    params.assignmentAllowed &&
    params.selectedCoordinatorUserAccountId.length > 0 &&
    params.selectedCoordinatorUserAccountId !== params.currentCoordinatorUserAccountId
  );
}
