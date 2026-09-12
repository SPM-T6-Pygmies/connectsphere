import { clientOrganisationId, type ClientOrganisationId } from "../domain/client-organisation";
import { DraftNotEditableError } from "../domain/errors";
import {
  eventRequestId,
  submitEventRequest,
  type EventRequest,
  type EventRequestDetails,
  type SubmittedEventRequest,
} from "../domain/event-request";
import { userAccountId, type UserAccountId } from "../domain/user-account";
import type { Clock } from "../ports/outbound/clock";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

/**
 * Submitting an event request -- this application's own API for it.
 *
 * Everything crossing this boundary is plain, serialisable data: no branded
 * ids, no `Date`, no domain objects. That is what lets a Server Action, a
 * webhook, a bulk importer or a test speak to the use case without first
 * learning how to construct a `ClientOrganisationId`.
 */
export interface SubmitEventRequestCommand {
  /**
   * The draft this submission completes, or `null` for one raised fresh.
   *
   * SPM-38: submitting a request that started life as a saved draft finishes
   * that same row rather than inserting a second one and leaving the draft
   * behind -- see `SubmitEventRequestUseCase`.
   */
  readonly eventRequestId: string | null;
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

export interface SubmitEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clock: Clock;
}

function detailsOf(command: SubmitEventRequestCommand): EventRequestDetails {
  return {
    eventName: command.eventName,
    description: command.description,
    purpose: command.purpose,
    preferredDate: command.preferredDate,
    preferredStartTime: command.preferredStartTime,
    preferredEndTime: command.preferredEndTime,
    expectedAttendance: command.expectedAttendance,
    venueRequirements: command.venueRequirements,
    roomLayoutPreferences: command.roomLayoutPreferences,
    accessibilityNeeds: command.accessibilityNeeds,
    equipmentRequirements: command.equipmentRequirements,
    registrationRequirements: command.registrationRequirements,
    generalProgramme: command.generalProgramme,
    otherSpecialArrangements: command.otherSpecialArrangements,
  };
}

/**
 * SPM-31: an Event Organiser states their requirements and submits.
 *
 * Read the body and notice there is no business rule in it. Which fields are
 * mandatory, and what a Submitted request looks like, both live in
 * `submitEventRequest`; what remains here is sequence -- build, store, report.
 *
 * Constructing the request before touching the repository is deliberate: an
 * incomplete submission is refused without a single byte crossing the network,
 * so a half-filled form can never leave a partial row behind.
 */
export class SubmitEventRequestUseCase {
  constructor(private readonly deps: SubmitEventRequestDeps) {}

  async execute(command: SubmitEventRequestCommand): Promise<SubmitEventRequestResult> {
    const { eventRequests, clock } = this.deps;
    const organiser = userAccountId(command.responsibleOrganiserId);
    const organisation = clientOrganisationId(command.clientOrganisationId);

    const submitted = submitEventRequest({
      details: detailsOf(command),
      clientOrganisationId: organisation,
      responsibleOrganiserId: organiser,
      submittedAt: clock.now(),
      organiserTimeZone: command.organiserTimeZone,
    });

    const stored =
      command.eventRequestId === null
        ? await eventRequests.create(submitted)
        : await this.submitExistingDraft(command.eventRequestId, submitted, organiser, organisation);

    return {
      eventRequestId: stored.id,
      status: stored.status,
      submittedAt: submitted.submittedAt.toISOString(),
      summary: {
        eventName: stored.details.eventName,
        preferredDate: stored.details.preferredDate,
        preferredStartTime: stored.details.preferredStartTime,
        preferredEndTime: stored.details.preferredEndTime,
        expectedAttendance: stored.details.expectedAttendance,
      },
    };
  }

  /**
   * SPM-38: finishes the Organiser's own draft rather than raising a second,
   * unrelated request -- the same access rule `eventRequestAccessFor` already
   * draws (edit, hence submit, only while it is still the caller's own
   * Draft) is checked again here because the store, not just the domain, has
   * to enforce it.
   */
  private async submitExistingDraft(
    rawId: string,
    submitted: SubmittedEventRequest,
    organiser: UserAccountId,
    organisation: ClientOrganisationId,
  ): Promise<EventRequest> {
    const id = eventRequestId(rawId);
    const existing = await this.deps.eventRequests.findById(id);

    if (
      existing === null ||
      existing.status !== "Draft" ||
      existing.responsibleOrganiserId !== organiser ||
      existing.clientOrganisationId !== organisation
    ) {
      throw new DraftNotEditableError(rawId);
    }

    const updated: EventRequest = { ...submitted, id };
    await this.deps.eventRequests.save(updated);
    return updated;
  }
}
