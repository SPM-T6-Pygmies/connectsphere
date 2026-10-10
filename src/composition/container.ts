import { Novu } from "@novu/api";

import { LoggingNotifier } from "@/adapters/outbound/logging/logging-notifier";
import { NovuNotifier } from "@/adapters/outbound/novu/novu-notifier";
import { subscriberHash } from "@/adapters/outbound/novu/subscriber-hash";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/adapters/outbound/supabase/client";
import { SupabaseClarificationThreadRepository } from "@/adapters/outbound/supabase/supabase-clarification-thread-repository";
import { SupabaseClientOrganisationRepository } from "@/adapters/outbound/supabase/supabase-client-organisation-repository";
import { SupabaseConnectionRepository } from "@/adapters/outbound/supabase/supabase-connection-repository";
import { SupabaseCoordinatorEventRepository } from "@/adapters/outbound/supabase/supabase-coordinator-event-repository";
import { SupabaseEquipmentCatalogue } from "@/adapters/outbound/supabase/supabase-equipment-catalogue";
import { SupabaseLeadEventRepository } from "@/adapters/outbound/supabase/supabase-lead-event-repository";
import { SupabaseTechnicalEquipmentRepository } from "@/adapters/outbound/supabase/supabase-technical-equipment-repository";
import { SupabaseSafetyCheckCandidateRepository } from "@/adapters/outbound/supabase/supabase-safety-check-candidate-repository";
import { SupabaseSafetyCheckRepository } from "@/adapters/outbound/supabase/supabase-safety-check-repository";
import { SupabaseSafetyCheckWatch } from "@/adapters/outbound/supabase/supabase-safety-check-watch";
import { SupabaseEquipmentRequirementRepository } from "@/adapters/outbound/supabase/supabase-equipment-requirement-repository";
import { SupabaseEventCatalogue } from "@/adapters/outbound/supabase/supabase-event-catalogue";
import { SupabaseEventReadinessRepository } from "@/adapters/outbound/supabase/supabase-event-readiness-repository";
import { SupabaseEventRequestRepository } from "@/adapters/outbound/supabase/supabase-event-request-repository";
import { SupabaseRegistrationRepository } from "@/adapters/outbound/supabase/supabase-registration-repository";
import { SupabaseMemberDirectory } from "@/adapters/outbound/supabase/supabase-member-directory";
import { SupabaseVenueAvailability } from "@/adapters/outbound/supabase/supabase-venue-availability";
import { SupabaseVenueCatalogue } from "@/adapters/outbound/supabase/supabase-venue-catalogue";
import { SupabaseVenueUnavailabilityRepository } from "@/adapters/outbound/supabase/supabase-venue-unavailability-repository";
import { SupabaseUserAccountRepository } from "@/adapters/outbound/supabase/supabase-user-account-repository";
import { SupabaseAuthAdapter } from "@/adapters/outbound/supabase/supabase-auth-adapter";
import { SupabaseUserRepository } from "@/adapters/outbound/supabase/supabase-user-repository";
import { SupabaseAuditLogger } from "@/adapters/outbound/supabase/supabase-audit-logger";
import { SupabaseBookingRepository } from "@/adapters/outbound/supabase/supabase-booking-repository";
import { SupabaseBookingReviewRepository } from "@/adapters/outbound/supabase/supabase-booking-review-repository";
import { SupabaseRecordingNotifier } from "@/adapters/outbound/supabase/supabase-recording-notifier";
import { systemClock } from "@/adapters/outbound/system/system-clock";
import type { BookingRepository } from "@/core/ports/outbound/booking-repository";
import type { ClientOrganisationRepository } from "@/core/ports/outbound/client-organisation-repository";
import type { ClarificationThreadRepository } from "@/core/ports/outbound/clarification-thread-repository";
import type { CoordinatorEventRepository } from "@/core/ports/outbound/coordinator-event-repository";
import type { EquipmentCatalogue } from "@/core/ports/outbound/equipment-catalogue";
import type { EquipmentRequirementRepository } from "@/core/ports/outbound/equipment-requirement-repository";
import type { EventCatalogue } from "@/core/ports/outbound/event-catalogue";
import type { EventReadinessRepository } from "@/core/ports/outbound/event-readiness-repository";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";
import type { Notifier } from "@/core/ports/outbound/notifier";
import type { RegistrationRepository } from "@/core/ports/outbound/registration-repository";
import type { UserAccountRepository } from "@/core/ports/outbound/user-account-repository";
import type { VenueCatalogue } from "@/core/ports/outbound/venue-catalogue";
import { AssignEventCoordinatorUseCase } from "@/core/use-cases/assign-event-coordinator";
import { ListEventsOpenForRegistrationUseCase } from "@/core/use-cases/list-events-open-for-registration";
import { ChangeEventOrganiserUseCase } from "@/core/use-cases/change-event-organiser";
import { SetEventRequiredFacilitiesUseCase } from "@/core/use-cases/set-event-required-facilities";
import { UpdateEventDetailsUseCase } from "@/core/use-cases/update-event-details";
import { ChangeBookingRoomLayoutUseCase } from "@/core/use-cases/change-booking-room-layout";
import { ConfirmEventUseCase } from "@/core/use-cases/confirm-event";
import { SafetyCheckEntryAnnouncer } from "@/core/use-cases/announce-safety-check-entry";
import { DecideBookingRequestUseCase } from "@/core/use-cases/decide-booking-request";
import { DecideEventRequestUseCase } from "@/core/use-cases/decide-event-request";
import { ReviewBookingRequestsUseCase } from "@/core/use-cases/review-booking-requests";
import { PostClarificationMessageUseCase } from "@/core/use-cases/post-clarification-message";
import { PostCoordinatorClarificationMessageUseCase } from "@/core/use-cases/post-coordinator-clarification-message";
import { RequestClarificationUseCase } from "@/core/use-cases/request-clarification";
import { ResolveClarificationThreadUseCase } from "@/core/use-cases/resolve-clarification-thread";
import type { StaffWorkspace } from "@/core/domain/staff-member";
import { userAccountId } from "@/core/domain/user-account";
import { IdentifyStaffMemberUseCase } from "@/core/use-cases/identify-staff-member";
import { LoginUseCase } from "@/core/use-cases/login";
import { LogoutUseCase } from "@/core/use-cases/logout";
import { DiscardEventRequestDraftUseCase } from "@/core/use-cases/discard-event-request-draft";
import { RegisterForEventUseCase } from "@/core/use-cases/register-for-event";
import { SaveEventRequestDraftUseCase } from "@/core/use-cases/save-event-request-draft";
import { SendConnectionRequestUseCase } from "@/core/use-cases/send-connection-request";
import { SubmitEventRequestUseCase } from "@/core/use-cases/submit-event-request";
import { SubmitVenueBookingRequestUseCase } from "@/core/use-cases/submit-venue-booking-request";
import { ViewArchivedEventRequestsUseCase } from "@/core/use-cases/view-archived-event-requests";
import { ViewAssignedEventRequestUseCase } from "@/core/use-cases/view-assigned-event-request";
import { ViewAssignedEventRequestsUseCase } from "@/core/use-cases/view-assigned-event-requests";
import { ViewAssignedEventsUseCase } from "@/core/use-cases/view-assigned-events";
import { ViewCoordinatorEventUseCase } from "@/core/use-cases/view-coordinator-event";
import { EditEquipmentRequirementUseCase } from "@/core/use-cases/edit-equipment-requirement";
import { ListEquipmentQueueUseCase } from "@/core/use-cases/list-equipment-queue";
import { MarkEquipmentLineUnfulfilledUseCase } from "@/core/use-cases/mark-equipment-line-unfulfilled";
import { ListEventsAwaitingSafetyCheckUseCase } from "@/core/use-cases/list-events-awaiting-safety-check";
import { RecordEquipmentRequirementUseCase } from "@/core/use-cases/record-equipment-requirement";
import { RemoveEquipmentRequirementUseCase } from "@/core/use-cases/remove-equipment-requirement";
import { ReserveEquipmentLineUseCase } from "@/core/use-cases/reserve-equipment-line";
import { UndoEquipmentRemovalUseCase } from "@/core/use-cases/undo-equipment-removal";
import { ViewEventEquipmentUseCase } from "@/core/use-cases/view-event-equipment";
import { ViewEventEquipmentForTechnicalSupportUseCase } from "@/core/use-cases/view-event-equipment-for-technical-support";
import { ViewEventForRegistrationUseCase } from "@/core/use-cases/view-event-for-registration";
import { ViewOrganiserEventRequestUseCase } from "@/core/use-cases/view-organiser-event-request";
import { ViewAllEventCoordinatorsUseCase } from "@/core/use-cases/view-all-event-coordinators";
import { ViewCoordinatorWorkloadsUseCase } from "@/core/use-cases/view-coordinator-workloads";
import { ReassignEventCoordinatorUseCase } from "@/core/use-cases/reassign-event-coordinator";
import { ViewLeadEventUseCase } from "@/core/use-cases/view-lead-event";
import { ViewAllEventRequestsUseCase } from "@/core/use-cases/view-all-event-requests";
import { ViewMyEventRequestsUseCase } from "@/core/use-cases/view-my-event-requests";
import { CreateEquipmentItemUseCase } from "@/core/use-cases/create-equipment-item";
import { ListEquipmentCatalogueUseCase } from "@/core/use-cases/list-equipment-catalogue";
import { ListOrganisationOrganisersUseCase } from "@/core/use-cases/list-organisation-organisers";
import { UpdateEquipmentStockUseCase } from "@/core/use-cases/update-equipment-stock";
import { ViewOrganisationEventRequestsUseCase } from "@/core/use-cases/view-organisation-event-requests";
import { ViewOperationsEventRequestUseCase } from "@/core/use-cases/view-operations-event-request";
import { ViewRegistrationUseCase } from "@/core/use-cases/view-registration";
import { ViewVenueBookingOptionsUseCase } from "@/core/use-cases/view-venue-booking-options";
import { WithdrawEventRequestUseCase } from "@/core/use-cases/withdraw-event-request";
import { WithdrawRegistrationUseCase } from "@/core/use-cases/withdraw-registration";
import { CreateVenueUseCase } from "@/core/use-cases/create-venue";
import { LiftVenueUnavailabilityUseCase } from "@/core/use-cases/lift-venue-unavailability";
import { ListVenueUnavailabilityUseCase } from "@/core/use-cases/list-venue-unavailability";
import { RecordVenueUnavailabilityUseCase } from "@/core/use-cases/record-venue-unavailability";
import { RecordSafetyCheckUseCase } from "@/core/use-cases/record-safety-check";
import { ResubmitForSafetyCheckUseCase } from "@/core/use-cases/resubmit-for-safety-check";
import { ViewEventSafetyChecksUseCase } from "@/core/use-cases/view-event-safety-checks";
import { ViewSafetyCheckUseCase } from "@/core/use-cases/view-safety-check";
import { SearchVenuesUseCase } from "@/core/use-cases/search-venues";
import { UpdateVenueUseCase } from "@/core/use-cases/update-venue";
import { ListVenuesUseCase, ViewVenueUseCase } from "@/core/use-cases/view-venues";

import { novuSubscriberPrefix } from "./novu-subscriber";

/**
 * The composition root: the one module allowed to know both sides.
 *
 * Every other file imports either the core or an adapter, never both. Because
 * all the wiring is here, "what is this application actually made of?" has a
 * single, readable answer -- and swapping Supabase for something else is a
 * change to this file plus one new adapter directory.
 *
 * Server-only. The ESLint boundaries stop `src/app` and `src/components` from
 * importing adapters directly so they have to come through here.
 */
export async function buildSendConnectionRequest(): Promise<SendConnectionRequestUseCase> {
  const client = await createSupabaseServerClient();

  return new SendConnectionRequestUseCase({
    connections: new SupabaseConnectionRepository(client),
    members: new SupabaseMemberDirectory(client),
    notifier: new LoggingNotifier(),
    clock: systemClock,
  });
}

async function attendeeAdapters(): Promise<{
  events: EventCatalogue;
  registrations: RegistrationRepository;
}> {
  const client = await createSupabaseServerClient();
  return {
    events: new SupabaseEventCatalogue(client),
    registrations: new SupabaseRegistrationRepository(client),
  };
}

export async function buildListEventsOpenForRegistration(): Promise<ListEventsOpenForRegistrationUseCase> {
  const { events } = await attendeeAdapters();

  return new ListEventsOpenForRegistrationUseCase({ events, clock: systemClock });
}

export async function buildViewEventForRegistration(): Promise<ViewEventForRegistrationUseCase> {
  const { events } = await attendeeAdapters();

  return new ViewEventForRegistrationUseCase({ events, clock: systemClock });
}

export async function buildRegisterForEvent(): Promise<RegisterForEventUseCase> {
  const { events, registrations } = await attendeeAdapters();

  return new RegisterForEventUseCase({ events, registrations, clock: systemClock });
}

export async function buildViewRegistration(): Promise<ViewRegistrationUseCase> {
  const { events, registrations } = await attendeeAdapters();

  return new ViewRegistrationUseCase({ events, registrations });
}

async function eventRequestAdapters(): Promise<EventRequestRepository> {
  return new SupabaseEventRequestRepository(await createSupabaseServerClient());
}

export async function buildSubmitEventRequest(): Promise<SubmitEventRequestUseCase> {
  return new SubmitEventRequestUseCase({
    eventRequests: await eventRequestAdapters(),
    clock: systemClock,
  });
}

export async function buildSaveEventRequestDraft(): Promise<SaveEventRequestDraftUseCase> {
  return new SaveEventRequestDraftUseCase({
    eventRequests: await eventRequestAdapters(),
  });
}

export async function buildDiscardEventRequestDraft(): Promise<DiscardEventRequestDraftUseCase> {
  return new DiscardEventRequestDraftUseCase({
    eventRequests: await eventRequestAdapters(),
  });
}

export async function buildViewMyEventRequests(): Promise<ViewMyEventRequestsUseCase> {
  return new ViewMyEventRequestsUseCase({ eventRequests: await eventRequestAdapters() });
}

export async function buildViewOrganiserEventRequest(): Promise<ViewOrganiserEventRequestUseCase> {
  const client = await createSupabaseServerClient();

  return new ViewOrganiserEventRequestUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    clarificationThread: new SupabaseClarificationThreadRepository(client),
    userAccounts: new SupabaseUserAccountRepository(client),
  });
}

export async function buildViewAllEventRequests(): Promise<ViewAllEventRequestsUseCase> {
  const client = await createSupabaseServerClient();
  return new ViewAllEventRequestsUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
  });
}

export async function buildViewOperationsEventRequest(): Promise<ViewOperationsEventRequestUseCase> {
  const client = await createSupabaseServerClient();
  return new ViewOperationsEventRequestUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
  });
}

export async function buildViewAllEventCoordinators(): Promise<ViewAllEventCoordinatorsUseCase> {
  return new ViewAllEventCoordinatorsUseCase({
    userAccounts: new SupabaseUserAccountRepository(await createSupabaseServerClient()),
  });
}

/** SPM-256: every coordinator with their requests and active events. */
export async function buildViewCoordinatorWorkloads(): Promise<ViewCoordinatorWorkloadsUseCase> {
  const client = await createSupabaseServerClient();
  return new ViewCoordinatorWorkloadsUseCase({
    userAccounts: new SupabaseUserAccountRepository(client),
    eventRequests: new SupabaseEventRequestRepository(client),
    leadEvents: new SupabaseLeadEventRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
  });
}

/** SPM-257: one event as the Lead opens it to reassign. */
export async function buildViewLeadEvent(): Promise<ViewLeadEventUseCase> {
  const client = await createSupabaseServerClient();
  return new ViewLeadEventUseCase({
    leadEvents: new SupabaseLeadEventRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
  });
}

/** SPM-257: the Lead hands an active event to another coordinator. */
export async function buildReassignEventCoordinator(): Promise<ReassignEventCoordinatorUseCase> {
  const client = await createSupabaseServerClient();
  return new ReassignEventCoordinatorUseCase({
    leadEvents: new SupabaseLeadEventRepository(client),
    userAccounts: new SupabaseUserAccountRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
    notifier: recordedNotifier(),
  });
}

export async function buildAssignEventCoordinator(): Promise<AssignEventCoordinatorUseCase> {
  const client = await createSupabaseServerClient();
  return new AssignEventCoordinatorUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    userAccounts: new SupabaseUserAccountRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
    notifier: recordedNotifier(),
  });
}

/**
 * Novu when it can actually run our workflows, the log otherwise -- so CI and
 * local dev without Novu need nothing extra -- and either way recorded in the
 * `notification` table (SPM-177).
 *
 * A deployment needs only the key: its workflows are synced to Novu. Locally
 * they are not, so Novu can reach them only through a `novu dev` tunnel, and a
 * trigger without `NOVU_BRIDGE_URL` just fails with `workflow_not_found`.
 */
function recordedNotifier(): Notifier {
  const secretKey = process.env.NOVU_SECRET_KEY;
  const bridgeUrl = process.env.NOVU_BRIDGE_URL || undefined;
  const novuCanRun = process.env.NODE_ENV === "production" || bridgeUrl !== undefined;
  const delivering =
    secretKey && novuCanRun
      ? new NovuNotifier(new Novu({ secretKey }), bridgeUrl, novuSubscriberPrefix())
      : new LoggingNotifier();
  return new SupabaseRecordingNotifier(createSupabaseAdminClient(), delivering);
}

export async function buildWithdrawRegistration(): Promise<WithdrawRegistrationUseCase> {
  const { events, registrations } = await attendeeAdapters();

  return new WithdrawRegistrationUseCase({ events, registrations });
}

/** Every event request in the caller's client organisation. */
export async function buildViewOrganisationEventRequests(): Promise<ViewOrganisationEventRequestsUseCase> {
  return new ViewOrganisationEventRequestsUseCase({ eventRequests: await eventRequestAdapters() });
}

/**
 * Who the coordinator screens are acting as: the signed-in Event Coordinator.
 *
 * `null` covers every case that isn't a coordinator -- no session, no matching
 * `user_account`, or a role other than Event Coordinator -- so callers answer
 * with access denied rather than someone else's queue (#91). Same shape as
 * `getCurrentOrganiser` below.
 */
/**
 * SPM-33: the Coordinator returns a request for clarification.
 *
 * Only the event request repository: opening a clarification writes the
 * status and the question in one transaction, so the thread is not a second
 * dependency here -- see `EventRequestRepository.returnEventRequest`.
 */
export async function buildRequestClarification(): Promise<RequestClarificationUseCase> {
  return new RequestClarificationUseCase({
    eventRequests: await eventRequestAdapters(),
    notifier: recordedNotifier(),
  });
}

/** SPM-33 AC6: the Coordinator marks one question answered, resuming the request if it was the last. */
export async function buildResolveClarificationThread(): Promise<ResolveClarificationThreadUseCase> {
  const client = await createSupabaseServerClient();
  return new ResolveClarificationThreadUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    clarificationThread: new SupabaseClarificationThreadRepository(client),
  });
}

/** SPM-33 AC4-AC5: the responsible Organiser answers on the thread. Appends, and nothing else. */
export async function buildPostClarificationMessage(): Promise<PostClarificationMessageUseCase> {
  const client = await createSupabaseServerClient();
  return new PostClarificationMessageUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    clarificationThread: new SupabaseClarificationThreadRepository(client),
  });
}

/** SPM-33 AC5: the assigned Coordinator follows up, without returning the request again. */
export async function buildPostCoordinatorClarificationMessage(): Promise<PostCoordinatorClarificationMessageUseCase> {
  const client = await createSupabaseServerClient();
  return new PostCoordinatorClarificationMessageUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    clarificationThread: new SupabaseClarificationThreadRepository(client),
  });
}

/**
 * The thread store, for the two view use cases that read it alongside their
 * request. Not exported: reading the thread is never a call of its own, so
 * nothing outside this module needs a handle on it.
 */
async function buildClarificationThread(): Promise<ClarificationThreadRepository> {
  return new SupabaseClarificationThreadRepository(await createSupabaseServerClient());
}

export async function getCurrentCoordinator(): Promise<{
  readonly userAccountId: string;
  readonly name: string;
} | null> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  return (await identifyStaffMember.execute())?.coordinator ?? null;
}

/**
 * Who Technical Support's screens are acting as: the signed-in Technical
 * Support Staff member (SPM-41 AC16).
 *
 * `null` covers every case that isn't one -- no session, no matching
 * `user_account`, or no Technical Support Staff role -- so callers refuse the
 * page rather than show their equipment lists. Same shape as `getCurrentCoordinator`.
 */
export async function getCurrentTechnicalSupport(): Promise<{ readonly userAccountId: string } | null> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  return (await identifyStaffMember.execute())?.technicalSupport ?? null;
}

/** SPM-273: the events on one of Technical Support's lists -- Needs review, Reviewed or Archive. */
export async function buildListEquipmentQueue(): Promise<ListEquipmentQueueUseCase> {
  const client = await createSupabaseServerClient();

  return new ListEquipmentQueueUseCase({ equipment: new SupabaseTechnicalEquipmentRepository(client) });
}

/** SPM-273 AC3-4: one event's equipment lines, as Technical Support see them. */
export async function buildViewEventEquipmentForTechnicalSupport(): Promise<ViewEventEquipmentForTechnicalSupportUseCase> {
  const client = await createSupabaseServerClient();

  return new ViewEventEquipmentForTechnicalSupportUseCase({
    equipment: new SupabaseTechnicalEquipmentRepository(client),
  });
}

/** SPM-274 AC1: reserve a line's full quantity. */
export async function buildReserveEquipmentLine(): Promise<ReserveEquipmentLineUseCase> {
  const client = await createSupabaseServerClient();

  return new ReserveEquipmentLineUseCase({ equipment: new SupabaseTechnicalEquipmentRepository(client) });
}

/** SPM-274 AC3: mark a line unfulfilled, with why. */
export async function buildMarkEquipmentLineUnfulfilled(): Promise<MarkEquipmentLineUnfulfilledUseCase> {
  const client = await createSupabaseServerClient();

  return new MarkEquipmentLineUnfulfilledUseCase({ equipment: new SupabaseTechnicalEquipmentRepository(client) });
}

/**
 * Who the Safety Officer's screens are acting as: the signed-in Safety Officer
 * (SPM-259 AC7). `null` for anyone else, so callers refuse the page. Same
 * shape as `getCurrentTechnicalSupport`.
 */
export async function getCurrentSafetyOfficer(): Promise<{ readonly userAccountId: string } | null> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  return (await identifyStaffMember.execute())?.safetyOfficer ?? null;
}

/**
 * Who the Event Coordinator Lead's screens are acting as: the signed-in Lead
 * (SPM-256). `null` for anyone else, so callers refuse the page. Same shape
 * as `getCurrentSafetyOfficer`.
 */
export async function getCurrentCoordinatorLead(): Promise<{ readonly userAccountId: string } | null> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  return (await identifyStaffMember.execute())?.coordinatorLead ?? null;
}

/** SPM-259: the events awaiting a safety check. */
export async function buildListEventsAwaitingSafetyCheck(): Promise<ListEventsAwaitingSafetyCheckUseCase> {
  const client = await createSupabaseServerClient();

  return new ListEventsAwaitingSafetyCheckUseCase({ candidates: new SupabaseSafetyCheckCandidateRepository(client) });
}

/** SPM-260: one event as the Safety Officer reviews it, with its recorded checks. */
export async function buildViewSafetyCheck(): Promise<ViewSafetyCheckUseCase> {
  const client = await createSupabaseServerClient();

  return new ViewSafetyCheckUseCase({ safetyChecks: new SupabaseSafetyCheckRepository(client) });
}

/** SPM-260: a Safety Officer records Approved or Rejected on an event, and SPM-263 tells its coordinator. */
export async function buildRecordSafetyCheck(): Promise<RecordSafetyCheckUseCase> {
  const client = await createSupabaseServerClient();

  return new RecordSafetyCheckUseCase({
    safetyChecks: new SupabaseSafetyCheckRepository(client),
    notifier: recordedNotifier(),
  });
}

async function coordinatorAdapters(): Promise<{
  eventRequests: EventRequestRepository;
  events: CoordinatorEventRepository;
  readiness: EventReadinessRepository;
  clientOrganisations: ClientOrganisationRepository;
  userAccounts: UserAccountRepository;
  equipment: EquipmentRequirementRepository;
}> {
  const client = await createSupabaseServerClient();
  return {
    eventRequests: new SupabaseEventRequestRepository(client),
    events: new SupabaseCoordinatorEventRepository(client),
    readiness: new SupabaseEventReadinessRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
    userAccounts: new SupabaseUserAccountRepository(client),
    equipment: new SupabaseEquipmentRequirementRepository(client),
  };
}

/** SPM-121: every request assigned to the caller and still awaiting review. */
export async function buildViewAssignedEventRequests(): Promise<ViewAssignedEventRequestsUseCase> {
  const { eventRequests, clientOrganisations } = await coordinatorAdapters();

  return new ViewAssignedEventRequestsUseCase({ eventRequests, clientOrganisations });
}

/** The coordinator's Archive: requests assigned to the caller that were rejected or withdrawn. */
export async function buildViewArchivedEventRequests(): Promise<ViewArchivedEventRequestsUseCase> {
  const { eventRequests, clientOrganisations } = await coordinatorAdapters();

  return new ViewArchivedEventRequestsUseCase({ eventRequests, clientOrganisations });
}

/** SPM-32: one event request, exactly as submitted, to the coordinator it is assigned to. */
export async function buildViewAssignedEventRequest(): Promise<ViewAssignedEventRequestUseCase> {
  const { eventRequests, clientOrganisations, userAccounts } = await coordinatorAdapters();

  return new ViewAssignedEventRequestUseCase({
    eventRequests,
    clarificationThread: await buildClarificationThread(),
    clientOrganisations,
    userAccounts,
  });
}

/** SPM-34: the assigned coordinator approves or rejects a request. */
export async function buildDecideEventRequest(): Promise<DecideEventRequestUseCase> {
  const { eventRequests } = await coordinatorAdapters();

  return new DecideEventRequestUseCase({ eventRequests, notifier: recordedNotifier() });
}

/** SPM-101: the assigned coordinator records a withdrawal the Organiser asked for. */
export async function buildWithdrawEventRequest(): Promise<WithdrawEventRequestUseCase> {
  const { eventRequests } = await coordinatorAdapters();

  return new WithdrawEventRequestUseCase({ eventRequests });
}

/**
 * "My events": every event the caller is coordinating, whatever its status.
 * Events are opened by approving a request (SPM-34).
 */
export async function buildViewAssignedEvents(): Promise<ViewAssignedEventsUseCase> {
  const { events } = await coordinatorAdapters();

  return new ViewAssignedEventsUseCase({ events });
}

async function venueBookingAdapters(): Promise<{
  events: CoordinatorEventRepository;
  venues: VenueCatalogue;
  bookings: BookingRepository;
}> {
  const client = await createSupabaseServerClient();
  return {
    events: new SupabaseCoordinatorEventRepository(client),
    venues: new SupabaseVenueCatalogue(client),
    bookings: new SupabaseBookingRepository(client),
  };
}

/** SPM-46: the coordinator's booking page -- the event, the venues, the bookings so far. */
export async function buildViewVenueBookingOptions(): Promise<ViewVenueBookingOptionsUseCase> {
  return new ViewVenueBookingOptionsUseCase(await venueBookingAdapters());
}

/** SPM-46 / SPM-104: the assigned coordinator submits a venue booking request. */
export async function buildSubmitVenueBookingRequest(): Promise<SubmitVenueBookingRequestUseCase> {
  return new SubmitVenueBookingRequestUseCase(await venueBookingAdapters());
}

/** SPM-104: the assigned coordinator moves a pending booking request to another layout. */
export async function buildChangeBookingRoomLayout(): Promise<ChangeBookingRoomLayoutUseCase> {
  return new ChangeBookingRoomLayoutUseCase(await venueBookingAdapters());
}

/** SPM-247: the assigned coordinator records the facilities an event needs. */
export async function buildSetEventRequiredFacilities(): Promise<SetEventRequiredFacilitiesUseCase> {
  return new SetEventRequiredFacilitiesUseCase({ events: (await venueBookingAdapters()).events });
}

/** SPM-49: the assigned coordinator updates an event's ordinary details. */
export async function buildUpdateEventDetails(): Promise<UpdateEventDetailsUseCase> {
  return new UpdateEventDetailsUseCase({ events: (await venueBookingAdapters()).events });
}

/** SPM-22: the signed-in Venue Staff member, or null for anyone else (answered as not found, #91). */
export async function getCurrentVenueStaff(): Promise<{
  readonly userAccountId: string;
  readonly name: string;
} | null> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  const member = await identifyStaffMember.execute();
  return member !== null && member.workspaces.includes("venue")
    ? { userAccountId: member.userAccountId, name: member.name }
    : null;
}

/** SPM-22: the booking requests Venue Staff work from, and one request beside its venue. */
export async function buildReviewBookingRequests(): Promise<ReviewBookingRequestsUseCase> {
  const client = await createSupabaseServerClient();
  return new ReviewBookingRequestsUseCase({
    reviews: new SupabaseBookingReviewRepository(client),
    venues: new SupabaseVenueCatalogue(client),
  });
}

/**
 * SPM-262: tells every Safety Officer when a change puts an event on their
 * list. Reads with the admin client: the change is Venue Staff's or a
 * coordinator's, and neither may read the safety list themselves.
 */
function safetyCheckAnnouncer(): SafetyCheckEntryAnnouncer {
  return new SafetyCheckEntryAnnouncer({
    watch: new SupabaseSafetyCheckWatch(createSupabaseAdminClient()),
    notifier: recordedNotifier(),
  });
}

/** SPM-261: an event's safety checks, for its assigned coordinator. */
export async function buildViewEventSafetyChecks(): Promise<ViewEventSafetyChecksUseCase> {
  const client = await createSupabaseServerClient();

  return new ViewEventSafetyChecksUseCase({ safetyChecks: new SupabaseSafetyCheckRepository(client) });
}

/** SPM-261: the coordinator sends a rejected event back for a fresh safety check. */
export async function buildResubmitForSafetyCheck(): Promise<ResubmitForSafetyCheckUseCase> {
  const client = await createSupabaseServerClient();

  return new ResubmitForSafetyCheckUseCase({
    safetyChecks: new SupabaseSafetyCheckRepository(client),
    safetyCheck: safetyCheckAnnouncer(),
  });
}

/** SPM-22: Venue Staff approve or reject a booking request. */
export async function buildDecideBookingRequest(): Promise<DecideBookingRequestUseCase> {
  const client = await createSupabaseServerClient();
  return new DecideBookingRequestUseCase({
    reviews: new SupabaseBookingReviewRepository(client),
    bookings: new SupabaseBookingRepository(client),
    safetyCheck: safetyCheckAnnouncer(),
  });
}

/** SPM-50: one event and its confirmation readiness, to the coordinator it is assigned to. */
export async function buildViewCoordinatorEvent(): Promise<ViewCoordinatorEventUseCase> {
  const { events, readiness, clientOrganisations, userAccounts } = await coordinatorAdapters();

  return new ViewCoordinatorEventUseCase({ events, readiness, clientOrganisations, userAccounts });
}

/** SPM-50: the assigned coordinator confirms an event once nothing essential is left incomplete. */
export async function buildConfirmEvent(): Promise<ConfirmEventUseCase> {
  const { events, readiness } = await coordinatorAdapters();

  return new ConfirmEventUseCase({ events, readiness });
}

/** SPM-41: an event's equipment requirement lines, to the coordinator it is assigned to. */
export async function buildViewEventEquipment(): Promise<ViewEventEquipmentUseCase> {
  const { events, equipment } = await coordinatorAdapters();

  return new ViewEventEquipmentUseCase({ events, equipment });
}

/** SPM-41 AC1-5: the assigned coordinator adds a line to an event's equipment requirements. */
export async function buildRecordEquipmentRequirement(): Promise<RecordEquipmentRequirementUseCase> {
  const { events, equipment } = await coordinatorAdapters();

  return new RecordEquipmentRequirementUseCase({ events, equipment });
}

/** SPM-41 AC7-9: the assigned coordinator changes a line's quantity or technical requirements. */
export async function buildEditEquipmentRequirement(): Promise<EditEquipmentRequirementUseCase> {
  const { events, equipment } = await coordinatorAdapters();

  return new EditEquipmentRequirementUseCase({ events, equipment, safetyCheck: safetyCheckAnnouncer() });
}

/** SPM-41 AC10-11: the assigned coordinator removes a line. */
export async function buildRemoveEquipmentRequirement(): Promise<RemoveEquipmentRequirementUseCase> {
  const { events, equipment } = await coordinatorAdapters();

  return new RemoveEquipmentRequirementUseCase({ events, equipment, safetyCheck: safetyCheckAnnouncer() });
}

/** SPM-41 AC17: the assigned coordinator takes back a removal Technical Support have not yet acted on. */
export async function buildUndoEquipmentRemoval(): Promise<UndoEquipmentRemovalUseCase> {
  const { events, equipment } = await coordinatorAdapters();

  return new UndoEquipmentRemovalUseCase({ events, equipment, safetyCheck: safetyCheckAnnouncer() });
}

/** SPM-39 AC5: reassigns an event request's responsible Organiser. */
export async function buildChangeEventOrganiser(): Promise<ChangeEventOrganiserUseCase> {
  return new ChangeEventOrganiserUseCase({ eventRequests: await eventRequestAdapters() });
}

/** SPM-39 AC5: who a request in this client organisation could be reassigned to. */
export async function buildListOrganisationOrganisers(): Promise<ListOrganisationOrganisersUseCase> {
  return new ListOrganisationOrganisersUseCase({
    userAccounts: new SupabaseUserAccountRepository(await createSupabaseServerClient()),
  });
}

export async function buildLogin(): Promise<LoginUseCase> {
  return new LoginUseCase({
    auth: new SupabaseAuthAdapter(await createSupabaseServerClient()),
    users: new SupabaseUserRepository(createSupabaseAdminClient()),
  });
}

export async function buildLogout(): Promise<LogoutUseCase> {
  return new LogoutUseCase({
    auth: new SupabaseAuthAdapter(await createSupabaseServerClient()),
    users: new SupabaseUserRepository(createSupabaseAdminClient()),
    auditLogger: new SupabaseAuditLogger(createSupabaseAdminClient()),
  });
}

/** The signed-in member of staff, behind every `getCurrent*` lookup in this file. */
async function buildIdentifyStaffMember(): Promise<IdentifyStaffMemberUseCase> {
  return new IdentifyStaffMemberUseCase({
    auth: new SupabaseAuthAdapter(await createSupabaseServerClient()),
    users: new SupabaseUserRepository(createSupabaseAdminClient()),
  });
}

/**
 * Who the organiser screens are acting as: the signed-in Event Organiser.
 *
 * `null` covers every case that isn't one -- no session, no matching
 * `user_account`, a role other than Event Organiser, or an Organiser with no
 * client organisation set -- so callers answer with access denied rather than
 * someone else's requests (#91). Same shape as `getCurrentCoordinator` above.
 */
export async function getCurrentOrganiser(): Promise<{
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
  readonly name: string;
} | null> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  return (await identifyStaffMember.execute())?.organiser ?? null;
}

/**
 * The staff workspaces the signed-in member of staff may open. Empty when
 * nobody is signed in or the auth user has no `user_account`, so a caller
 * checking its own workspace answers with access denied either way.
 */
export async function getStaffWorkspaces(): Promise<readonly StaffWorkspace[]> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  return (await identifyStaffMember.execute())?.workspaces ?? [];
}

/**
 * The signed-in member of staff as the staff chrome shows them: their name,
 * the workspaces they may open, the one an access-denied screen sends them
 * back to, and who their notification inbox belongs to. Null when nobody is
 * signed in or the auth user has no `user_account`.
 *
 * `subscriberHash` is null without `NOVU_SECRET_KEY`, and the chrome then
 * shows no inbox. The key itself never leaves the server.
 */
export async function getSignedInStaffMember(): Promise<{
  readonly name: string;
  readonly workspaces: readonly StaffWorkspace[];
  readonly homeWorkspace: StaffWorkspace | null;
  readonly subscriberId: string;
  readonly subscriberHash: string | null;
} | null> {
  const identifyStaffMember = await buildIdentifyStaffMember();
  const member = await identifyStaffMember.execute();
  if (member === null) {
    return null;
  }

  const secretKey = process.env.NOVU_SECRET_KEY;
  const subscriberId = `${novuSubscriberPrefix()}${member.userAccountId}`;
  return {
    name: member.name,
    workspaces: member.workspaces,
    homeWorkspace: member.homeWorkspace,
    subscriberId,
    subscriberHash: secretKey ? subscriberHash(subscriberId, secretKey) : null,
  };
}

async function venueCatalogue(): Promise<SupabaseVenueCatalogue> {
  return new SupabaseVenueCatalogue(await createSupabaseServerClient());
}

/** SPM-42: the venue catalogue, as Venue Staff and Event Coordinators read it. */
export async function buildListVenues(): Promise<ListVenuesUseCase> {
  return new ListVenuesUseCase({ venues: await venueCatalogue() });
}

export async function buildViewVenue(): Promise<ViewVenueUseCase> {
  return new ViewVenueUseCase({ venues: await venueCatalogue() });
}

/** SPM-44: an Event Coordinator searches the catalogue. Venues are in Singapore (#36). */
export async function buildSearchVenues(): Promise<SearchVenuesUseCase> {
  const client = await createSupabaseServerClient();
  return new SearchVenuesUseCase({
    venues: new SupabaseVenueCatalogue(client),
    availability: new SupabaseVenueAvailability(client),
    clock: systemClock,
    timeZone: "Asia/Singapore",
  });
}

/** SPM-146: Venue Staff add a venue and its layouts. */
export async function buildCreateVenue(): Promise<CreateVenueUseCase> {
  return new CreateVenueUseCase({ venues: await venueCatalogue() });
}

/** SPM-147: Venue Staff update a venue and its layouts. */
export async function buildUpdateVenue(): Promise<UpdateVenueUseCase> {
  return new UpdateVenueUseCase({ venues: await venueCatalogue() });
}

/**
 * The signed-in member's roles as far as venue maintenance goes: "Venue Staff"
 * exactly when they may open the venue workspace (`workspacesFor` maps that one
 * role to it), none otherwise. The database re-checks the real role on write.
 */
export async function getVenueMaintenanceRoles(): Promise<readonly string[]> {
  return (await getStaffWorkspaces()).includes("venue") ? ["Venue Staff"] : [];
}

/** SPM-21: Venue Staff block a venue for a period, with a reason. */
export async function buildRecordVenueUnavailability(): Promise<RecordVenueUnavailabilityUseCase> {
  const client = await createSupabaseServerClient();
  return new RecordVenueUnavailabilityUseCase({
    unavailability: new SupabaseVenueUnavailabilityRepository(client),
    venues: new SupabaseVenueCatalogue(client),
    clock: systemClock,
  });
}

/** SPM-21: Venue Staff lift a block early. */
export async function buildLiftVenueUnavailability(): Promise<LiftVenueUnavailabilityUseCase> {
  const client = await createSupabaseServerClient();
  return new LiftVenueUnavailabilityUseCase({
    unavailability: new SupabaseVenueUnavailabilityRepository(client),
    clock: systemClock,
  });
}

/** SPM-21: every block on every venue, In force and Lifted. */
export async function buildListVenueUnavailability(): Promise<ListVenueUnavailabilityUseCase> {
  const client = await createSupabaseServerClient();
  return new ListVenueUnavailabilityUseCase({
    unavailability: new SupabaseVenueUnavailabilityRepository(client),
  });
}

/**
 * SPM-40, SPM-17 AC5: the equipment catalogue, on the same `equipment_item`
 * rows coordinators pick from, acting as the signed-in Technical Support Staff
 * member. Anyone else gets an adapter whose every call is refused.
 */
async function buildEquipmentCatalogue(): Promise<EquipmentCatalogue> {
  const [client, technicalSupport] = await Promise.all([createSupabaseServerClient(), getCurrentTechnicalSupport()]);
  return new SupabaseEquipmentCatalogue(
    client,
    technicalSupport === null ? null : userAccountId(technicalSupport.userAccountId),
  );
}

export async function buildListEquipmentCatalogue(): Promise<ListEquipmentCatalogueUseCase> {
  return new ListEquipmentCatalogueUseCase({ equipment: await buildEquipmentCatalogue(), clock: systemClock });
}

export async function buildCreateEquipmentItem(): Promise<CreateEquipmentItemUseCase> {
  return new CreateEquipmentItemUseCase({ equipment: await buildEquipmentCatalogue() });
}

export async function buildUpdateEquipmentStock(): Promise<UpdateEquipmentStockUseCase> {
  return new UpdateEquipmentStockUseCase({ equipment: await buildEquipmentCatalogue() });
}
