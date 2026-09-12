import type { EventRequestStatus } from "../../domain/event-request";

/** Every persisted event-request attribute needed by the Operations screens. */
export interface OperationsEventRequest {
  readonly id: string;
  readonly eventName: string;
  readonly description: string | null;
  readonly purpose: string | null;
  readonly preferredDate: string | null;
  readonly preferredStartTime: string | null;
  readonly preferredEndTime: string | null;
  readonly expectedAttendance: number | null;
  readonly venueRequirements: string | null;
  readonly accessibilityNeeds: string | null;
  readonly equipmentRequirements: string | null;
  readonly registrationRequirements: string | null;
  readonly roomLayoutPreferences: string | null;
  readonly generalProgramme: string | null;
  readonly otherSpecialArrangements: string | null;
  readonly status: EventRequestStatus;
  readonly decisionRecord: string | null;
  readonly requestingUserAccountId: string;
  readonly assignedCoordinatorUserAccountId: string | null;
  readonly clientOrganisationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ViewAllEventRequestsResult {
  readonly eventRequests: readonly OperationsEventRequest[];
}

export interface ViewAllEventRequests {
  execute(): Promise<ViewAllEventRequestsResult>;
}
