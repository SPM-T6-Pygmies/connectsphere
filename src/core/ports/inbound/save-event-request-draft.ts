/**
 * Saving an event request as a draft (SPM-38) -- this application's own API
 * for it, the same way `SubmitEventRequestCommand` is for submission.
 *
 * `eventRequestId` is the one thing this command has that submission does
 * not: `null` for a fresh draft, or an existing draft's id to update it in
 * place rather than leaving a second row behind every time the Organiser
 * saves again.
 */
export interface SaveEventRequestDraftCommand {
  readonly eventRequestId: string | null;
  readonly responsibleOrganiserId: string;
  readonly clientOrganisationId: string;
  readonly eventName: string;
  readonly description: string | null;
  readonly purpose: string | null;
  readonly preferredDate: string | null;
  readonly preferredStartTime: string | null;
  readonly preferredEndTime: string | null;
  readonly expectedAttendance: number | null;
  readonly venueRequirements: string | null;
  readonly roomLayoutPreferences: string | null;
  readonly accessibilityNeeds: string | null;
  readonly equipmentRequirements: string | null;
  readonly registrationRequirements: string | null;
  readonly generalProgramme: string | null;
  readonly otherSpecialArrangements: string | null;
}

export interface SaveEventRequestDraftResult {
  readonly eventRequestId: string;
}

export interface SaveEventRequestDraft {
  execute(command: SaveEventRequestDraftCommand): Promise<SaveEventRequestDraftResult>;
}
