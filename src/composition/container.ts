import { LoggingNotifier } from "@/adapters/outbound/logging/logging-notifier";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/adapters/outbound/supabase/client";
import { SupabaseClientOrganisationRepository } from "@/adapters/outbound/supabase/supabase-client-organisation-repository";
import { SupabaseConnectionRepository } from "@/adapters/outbound/supabase/supabase-connection-repository";
import { SupabaseCoordinatorEventRepository } from "@/adapters/outbound/supabase/supabase-coordinator-event-repository";
import { SupabaseEventCoordinatorDirectory } from "@/adapters/outbound/supabase/supabase-event-coordinator-directory";
import { SupabaseEventCatalogue } from "@/adapters/outbound/supabase/supabase-event-catalogue";
import { SupabaseEventRequestRepository } from "@/adapters/outbound/supabase/supabase-event-request-repository";
import { SupabaseOrganiserDirectory } from "@/adapters/outbound/supabase/supabase-organiser-directory";
import { SupabaseRegistrationRepository } from "@/adapters/outbound/supabase/supabase-registration-repository";
import { SupabaseMemberDirectory } from "@/adapters/outbound/supabase/supabase-member-directory";
import { SupabaseUserAccountRepository } from "@/adapters/outbound/supabase/supabase-user-account-repository";
import { SupabaseAuthAdapter } from "@/adapters/outbound/supabase/supabase-auth-adapter";
import { SupabaseUserRepository } from "@/adapters/outbound/supabase/supabase-user-repository";
import { SupabaseAuditLogger } from "@/adapters/outbound/supabase/supabase-audit-logger";
import { systemClock } from "@/adapters/outbound/system/system-clock";
import type { ClientOrganisationRepository } from "@/core/ports/outbound/client-organisation-repository";
import type { CoordinatorEventRepository } from "@/core/ports/outbound/coordinator-event-repository";
import type { EventCatalogue } from "@/core/ports/outbound/event-catalogue";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";
import type { RegistrationRepository } from "@/core/ports/outbound/registration-repository";
import type { UserAccountRepository } from "@/core/ports/outbound/user-account-repository";
import { AssignEventCoordinatorUseCase } from "@/core/use-cases/assign-event-coordinator";
import { ListEventsOpenForRegistrationUseCase } from "@/core/use-cases/list-events-open-for-registration";
import { ChangeEventOrganiserUseCase } from "@/core/use-cases/change-event-organiser";
import { DecideEventRequestUseCase } from "@/core/use-cases/decide-event-request";
import { LoginUseCase } from "@/core/use-cases/login";
import { LogoutUseCase } from "@/core/use-cases/logout";
import { DiscardEventRequestDraftUseCase } from "@/core/use-cases/discard-event-request-draft";
import { RegisterForEventUseCase } from "@/core/use-cases/register-for-event";
import { SaveEventRequestDraftUseCase } from "@/core/use-cases/save-event-request-draft";
import { SendConnectionRequestUseCase } from "@/core/use-cases/send-connection-request";
import { SubmitEventRequestUseCase } from "@/core/use-cases/submit-event-request";
import { ViewArchivedEventRequestsUseCase } from "@/core/use-cases/view-archived-event-requests";
import { ViewAssignedEventRequestUseCase } from "@/core/use-cases/view-assigned-event-request";
import { ViewAssignedEventRequestsUseCase } from "@/core/use-cases/view-assigned-event-requests";
import { ViewAssignedEventsUseCase } from "@/core/use-cases/view-assigned-events";
import { ViewEventForRegistrationUseCase } from "@/core/use-cases/view-event-for-registration";
import { ViewOrganiserEventRequestUseCase } from "@/core/use-cases/view-organiser-event-request";
import { ViewAllEventCoordinatorsUseCase } from "@/core/use-cases/view-all-event-coordinators";
import { ViewAllEventRequestsUseCase } from "@/core/use-cases/view-all-event-requests";
import { ViewMyEventRequestsUseCase } from "@/core/use-cases/view-my-event-requests";
import { ListOrganisationOrganisersUseCase } from "@/core/use-cases/list-organisation-organisers";
import { ViewOrganisationEventRequestsUseCase } from "@/core/use-cases/view-organisation-event-requests";
import { ViewOperationsEventRequestUseCase } from "@/core/use-cases/view-operations-event-request";
import { ViewRegistrationUseCase } from "@/core/use-cases/view-registration";
import { WithdrawRegistrationUseCase } from "@/core/use-cases/withdraw-registration";

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
  return new ViewOrganiserEventRequestUseCase({
    eventRequests: await eventRequestAdapters(),
  });
}

export async function buildViewAllEventRequests(): Promise<ViewAllEventRequestsUseCase> {
  return new ViewAllEventRequestsUseCase({
    eventRequests: await eventRequestAdapters(),
  });
}

export async function buildViewOperationsEventRequest(): Promise<ViewOperationsEventRequestUseCase> {
  return new ViewOperationsEventRequestUseCase({
    eventRequests: await eventRequestAdapters(),
  });
}

export async function buildViewAllEventCoordinators(): Promise<ViewAllEventCoordinatorsUseCase> {
  return new ViewAllEventCoordinatorsUseCase({
    eventCoordinators: new SupabaseEventCoordinatorDirectory(await createSupabaseServerClient()),
  });
}

export async function buildAssignEventCoordinator(): Promise<AssignEventCoordinatorUseCase> {
  const client = await createSupabaseServerClient();
  return new AssignEventCoordinatorUseCase({
    eventRequests: new SupabaseEventRequestRepository(client),
    eventCoordinators: new SupabaseEventCoordinatorDirectory(client),
  });
}

/**
 * Who the organiser screens are acting as -- a stand-in until #62 settles how
 * this system authenticates.
 *
 * It lives here because it is ambient outside state read from the environment,
 * and because it is the one line that changes when a real session arrives: the
 * Server Action asks the composition root who is calling rather than trusting
 * a hidden input, so the browser cannot nominate someone else in the meantime.
 *
 * The defaults are `1`/`1` because `user_account` and `client_organisation`
 * number their rows from one; set them to real ids from your own project if
 * yours differ.
 */
export function actingOrganiser(): {
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
} {
  return {
    userAccountId: process.env.DEMO_ORGANISER_USER_ACCOUNT_ID ?? "1",
    clientOrganisationId: process.env.DEMO_CLIENT_ORGANISATION_ID ?? "1",
  };
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
 * with a not-found rather than someone else's queue (#91). Same shape as
 * `getCurrentOrganiser` below.
 */
export async function getCurrentCoordinator(): Promise<{ readonly userAccountId: string } | null> {
  const session = await new SupabaseAuthAdapter(await createSupabaseServerClient()).getSession();
  if (session === null) {
    return null;
  }

  const user = await new SupabaseUserRepository(createSupabaseAdminClient()).findByAuthUserId(session.userId);
  if (user === null || !user.roles.includes("Event Coordinator")) {
    return null;
  }

  return { userAccountId: user.userId };
}

async function coordinatorAdapters(): Promise<{
  eventRequests: EventRequestRepository;
  events: CoordinatorEventRepository;
  clientOrganisations: ClientOrganisationRepository;
  userAccounts: UserAccountRepository;
}> {
  const client = await createSupabaseServerClient();
  return {
    eventRequests: new SupabaseEventRequestRepository(client),
    events: new SupabaseCoordinatorEventRepository(client),
    clientOrganisations: new SupabaseClientOrganisationRepository(client),
    userAccounts: new SupabaseUserAccountRepository(client),
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

  return new ViewAssignedEventRequestUseCase({ eventRequests, clientOrganisations, userAccounts });
}

/** SPM-34: the assigned coordinator approves or rejects a request. */
export async function buildDecideEventRequest(): Promise<DecideEventRequestUseCase> {
  const { eventRequests } = await coordinatorAdapters();

  return new DecideEventRequestUseCase({ eventRequests });
}

/**
 * "My events": every event the caller is coordinating, whatever its status.
 * Events are opened by approving a request (SPM-34).
 */
export async function buildViewAssignedEvents(): Promise<ViewAssignedEventsUseCase> {
  const { events, clientOrganisations } = await coordinatorAdapters();

  return new ViewAssignedEventsUseCase({ events, clientOrganisations });
}

/** SPM-39 AC5: reassigns an event request's responsible Organiser. */
export async function buildChangeEventOrganiser(): Promise<ChangeEventOrganiserUseCase> {
  return new ChangeEventOrganiserUseCase({ eventRequests: await eventRequestAdapters() });
}

/** SPM-39 AC5: who a request in this client organisation could be reassigned to. */
export async function buildListOrganisationOrganisers(): Promise<ListOrganisationOrganisersUseCase> {
  return new ListOrganisationOrganisersUseCase({
    organisers: new SupabaseOrganiserDirectory(await createSupabaseServerClient()),
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
    auditLogger: new SupabaseAuditLogger(createSupabaseAdminClient()),
  });
}

/**
 * SPM-39: the real, session-derived counterpart to `actingOrganiser()`.
 *
 * `actingOrganiser()` (above) is an env-var stand-in other Requester pages
 * still use, predating SPM-13. Now that login exists, this resolves the
 * actual signed-in Organiser instead: `null` covers every case that isn't
 * one -- no session, no matching `user_account`, a role other than Event
 * Organiser, or an Organiser with no client organisation set -- so a caller
 * can fall back (e.g. to a demo identity) rather than crash.
 */
export async function getCurrentOrganiser(): Promise<{
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
  readonly name: string;
} | null> {
  const session = await new SupabaseAuthAdapter(await createSupabaseServerClient()).getSession();
  if (session === null) {
    return null;
  }

  const user = await new SupabaseUserRepository(createSupabaseAdminClient()).findByAuthUserId(session.userId);
  if (
    user === null ||
    user.clientOrganisationId === null ||
    !user.roles.includes("Event Organiser")
  ) {
    return null;
  }

  return {
    userAccountId: user.userId,
    clientOrganisationId: user.clientOrganisationId,
    name: user.name,
  };
}

/**
 * The signed-in caller's `user_account_id`, whatever their role -- unlike
 * `getCurrentOrganiser`/`getCurrentCoordinator`, which answer `null` for any
 * other role. `null` means no session or no matching `user_account`.
 */
export async function getCurrentUserAccountId(): Promise<string | null> {
  const session = await new SupabaseAuthAdapter(await createSupabaseServerClient()).getSession();
  if (session === null) {
    return null;
  }

  const user = await new SupabaseUserRepository(createSupabaseAdminClient()).findByAuthUserId(session.userId);
  return user?.userId ?? null;
}
