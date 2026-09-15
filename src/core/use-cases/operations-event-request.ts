import type { EventRequest, EventRequestStatus } from "../domain/event-request";

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

/** Maps the domain entity to the shared Event Operations read model. */
export function toOperationsEventRequest(request: EventRequest): OperationsEventRequest {
  return {
    id: request.id,
    eventName: request.details.eventName,
    description: request.details.description,
    purpose: request.details.purpose,
    preferredDate: request.details.preferredDate,
    preferredStartTime: request.details.preferredStartTime,
    preferredEndTime: request.details.preferredEndTime,
    expectedAttendance: request.details.expectedAttendance,
    venueRequirements: request.details.venueRequirements,
    accessibilityNeeds: request.details.accessibilityNeeds,
    equipmentRequirements: request.details.equipmentRequirements,
    registrationRequirements: request.details.registrationRequirements,
    roomLayoutPreferences: request.details.roomLayoutPreferences,
    generalProgramme: request.details.generalProgramme,
    otherSpecialArrangements: request.details.otherSpecialArrangements,
    status: request.status,
    decisionRecord: request.decisionRecord,
    requestingUserAccountId: request.responsibleOrganiserId,
    assignedCoordinatorUserAccountId: request.assignedCoordinatorUserAccountId,
    clientOrganisationId: request.clientOrganisationId,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
