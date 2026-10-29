import { changeRequestStatus, type ChangeRequest } from "../domain/change-request";
import { eventId } from "../domain/event";
import type { TimeRangeOnDate } from "../domain/event-times";
import type { RegistrationSettings } from "../domain/event-registration-settings";
import { userAccountId } from "../domain/user-account";
import type { ChangeRequestRepository } from "../ports/outbound/change-request-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface ViewEventChangeRequestsQuery {
  readonly eventId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
}

export interface ViewEventChangeRequestsDeps {
  readonly changeRequests: ChangeRequestRepository;
  readonly coordinatorEvents: CoordinatorEventRepository;
}

/** The event's value now for each field a change request can cover, to show beside what is asked. */
export interface CurrentChangeRequestValues {
  readonly times: readonly TimeRangeOnDate[];
  readonly venue_requirements: string | null;
  readonly expected_attendance: number | null;
  readonly equipment_requirements: string | null;
  readonly registration: RegistrationSettings;
}

export interface EventChangeRequestsView {
  readonly eventName: string;
  readonly current: CurrentChangeRequestValues;
  /** The request waiting on the Coordinator, if any; at most one is open (SPM-52). */
  readonly open: ChangeRequest | null;
  /** Requests already decided, newest first. */
  readonly decided: readonly ChangeRequest[];
}

/**
 * SPM-100 AC1: the assigned Coordinator sees a change request as the fields it
 * covers, each with its requested value beside the current one, and the
 * requests already decided.
 */
export class ViewEventChangeRequestsUseCase {
  constructor(private readonly deps: ViewEventChangeRequestsDeps) {}

  /** Null when the event is not assigned to the caller, or does not exist (#91). */
  async execute(query: ViewEventChangeRequestsQuery): Promise<EventChangeRequestsView | null> {
    const coordinator = userAccountId(query.userAccountId);
    const id = eventId(query.eventId);

    const [details, event] = await Promise.all([
      this.deps.coordinatorEvents.findAssigned(coordinator, query.eventId),
      this.deps.coordinatorEvents.findAssignedById(coordinator, id),
    ]);
    if (details === null || event === null) {
      return null;
    }

    const requests = await this.deps.changeRequests.listForEvent(coordinator, id);
    return {
      eventName: details.name,
      current: {
        times: details.times,
        venue_requirements: details.venueRequirements,
        expected_attendance: details.expectedAttendance,
        equipment_requirements: event.statedEquipmentNeeds,
        registration: {
          enabled: details.registrationEnabled,
          opensOn: details.registrationOpensOn,
          closesOn: details.registrationClosesOn,
        },
      },
      open: requests.find((request) => changeRequestStatus(request) === "Pending") ?? null,
      decided: requests.filter((request) => changeRequestStatus(request) === "Decided"),
    };
  }
}
