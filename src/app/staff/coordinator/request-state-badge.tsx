import { Badge } from "@/components/ui/badge";
import type { CoordinatorRequestState } from "@/core/domain/event-request";

/**
 * A request's standing in the Coordinator's own words (SPM-121).
 *
 * Deliberately not `StatusBadge`: that renders the stored
 * `EventRequestStatus`, which is the Organiser's vocabulary. `Submitted` and
 * `Under Review` are a distinction the Organiser cares about and the
 * Coordinator does not -- both are simply a request waiting on their
 * decision. What a Coordinator needs to tell apart is whether a request is
 * theirs to act on or sitting with the Organiser, which is the split below.
 *
 * Colour follows the same vocabulary as `StatusBadge` so a reader learns it
 * once: amber for in flight, grey for waiting on someone else, green
 * settled, red refused.
 */
const LABELS: Readonly<Record<CoordinatorRequestState, { text: string; variant: "warning" | "secondary" | "success" | "destructive" | "outline" }>> = {
  "awaiting-decision": { text: "Awaiting decision", variant: "warning" },
  "with-organiser": { text: "With organiser", variant: "secondary" },
  approved: { text: "Approved", variant: "success" },
  rejected: { text: "Rejected", variant: "destructive" },
  withdrawn: { text: "Withdrawn", variant: "outline" },
};

export function requestStateLabel(state: CoordinatorRequestState): string {
  return LABELS[state].text;
}

export function RequestStateBadge({ state }: { state: CoordinatorRequestState }) {
  const { text, variant } = LABELS[state];
  return <Badge variant={variant}>{text}</Badge>;
}
