import type { CoordinatorEvent, CoordinatorEventStatus } from "./coordinator-event";
import { coordinatorQueueStateFor, type EventRequest } from "./event-request";
import type { UserAccountId } from "./user-account";

/** An approved event still being worked on: from Planning through Confirmed (SPM-256 AC2). */
const ACTIVE_EVENT_STATUSES: ReadonlySet<CoordinatorEventStatus> = new Set([
  "Planning",
  "Blocked",
  "Confirmed",
]);

/** Whether an event is still being worked on, so its coordinator can still change. */
export function isActiveEvent(status: CoordinatorEventStatus): boolean {
  return ACTIVE_EVENT_STATUSES.has(status);
}

/** One coordinator's open requests and active events. */
export interface CoordinatorWorkload<R, E> {
  readonly coordinatorId: UserAccountId;
  readonly requests: readonly R[];
  readonly events: readonly E[];
}

/**
 * Every coordinator with the work assigned to them, for the Event Coordinator
 * Lead to spot when work needs to move (SPM-256).
 *
 * A request counts while it is still in its coordinator's queue
 * (`coordinatorQueueStateFor`); once Approved it is listed as its event
 * instead. An event counts while active, under the coordinator on the event
 * itself -- the request's coordinator stays frozen after approval, so it is
 * the event's that moves on reassignment (AC3). Every coordinator gets an
 * entry, even with nothing assigned, so an idle one is visible too.
 */
export function coordinatorWorkloads<
  R extends Pick<EventRequest, "status" | "assignedCoordinatorUserAccountId">,
  E extends Pick<CoordinatorEvent, "status" | "assignedCoordinatorUserAccountId">,
>(
  coordinatorIds: readonly UserAccountId[],
  requests: readonly R[],
  events: readonly E[],
): CoordinatorWorkload<R, E>[] {
  return coordinatorIds.map((coordinatorId) => ({
    coordinatorId,
    requests: requests.filter(
      (request) =>
        request.assignedCoordinatorUserAccountId === coordinatorId &&
        coordinatorQueueStateFor(request.status) !== null,
    ),
    events: events.filter(
      (event) =>
        event.assignedCoordinatorUserAccountId === coordinatorId && isActiveEvent(event.status),
    ),
  }));
}
