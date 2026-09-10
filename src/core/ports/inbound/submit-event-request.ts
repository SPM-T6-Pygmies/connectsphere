/**
 * Submitting an event request -- this application's own API for it.
 *
 * Everything crossing this boundary is plain, serialisable data: no branded
 * ids, no `Date`, no domain objects. That is what lets a Server Action, a
 * webhook, a bulk importer or a test speak to the use case without first
 * learning how to construct a `ClientOrganisationId`.
 */
export interface SubmitEventRequestCommand {
  readonly responsibleOrganiserId: string;
  readonly clientOrganisationId: string;
  /** IANA zone, e.g. `"Asia/Singapore"` -- read from the Organiser's own browser. */
  readonly organiserTimeZone: string;
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

/**
 * What was actually recorded, read back from the store rather than echoed from
 * the command.
 *
 * SPM-31 AC5 turns the form into a read-only acknowledgement, and it has to
 * show the request as it now stands -- including the id the store assigned,
 * which is the only handle the Organiser has on it afterwards.
 */
export interface SubmitEventRequestResult {
  readonly eventRequestId: string;
  readonly status: string;
  /** ISO 8601. */
  readonly submittedAt: string;
  readonly summary: {
    readonly eventName: string;
    readonly preferredDate: string | null;
    readonly preferredStartTime: string | null;
    readonly preferredEndTime: string | null;
    readonly expectedAttendance: number | null;
  };
}

export interface SubmitEventRequest {
  execute(command: SubmitEventRequestCommand): Promise<SubmitEventRequestResult>;
}
