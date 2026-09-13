import type { CoordinatorRequestState } from "@/core/domain/event-request";
import type { CoordinatorRequestLabel } from "@/lib/wireframe";

import { StatusBadge } from "../status-badge";

/**
 * A request's standing in the Coordinator's own words (SPM-121).
 *
 * `Submitted` and `Under Review` are a distinction the Organiser cares about
 * and the Coordinator does not -- both are simply a request waiting on their
 * decision. What a Coordinator needs to tell apart is whether a request is
 * theirs to act on or sitting with the Organiser, which is the split below.
 * Decided requests keep their own names: an outcome reads the same to
 * everyone.
 *
 * Rendering goes through `StatusBadge` so the colour vocabulary stays in one
 * place -- amber for in flight, grey for waiting on someone else.
 */
const LABELS: Readonly<Record<CoordinatorRequestState, CoordinatorRequestLabel | "Approved" | "Rejected" | "Withdrawn">> = {
  "awaiting-decision": "Awaiting decision",
  "with-organiser": "With organiser",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function requestStateLabel(state: CoordinatorRequestState) {
  return LABELS[state];
}

export function RequestStateBadge({ state }: { state: CoordinatorRequestState }) {
  return <StatusBadge status={LABELS[state]} />;
}
