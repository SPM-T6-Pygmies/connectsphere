import {
  demoEventCatalogue,
  demoEventRequestRepository,
  demoRegistrationRepository,
} from "@/adapters/outbound/in-memory/attendee-demo-seed";
import { demoEventRequestRepository as demoOrganisationEventRequestRepository } from "@/adapters/outbound/in-memory/organiser-demo-seed";
import { LoggingNotifier } from "@/adapters/outbound/logging/logging-notifier";
import { createSupabaseServerClient } from "@/adapters/outbound/supabase/client";
import { SupabaseConnectionRepository } from "@/adapters/outbound/supabase/supabase-connection-repository";
import { SupabaseEventCatalogue } from "@/adapters/outbound/supabase/supabase-event-catalogue";
import { SupabaseEventRequestRepository } from "@/adapters/outbound/supabase/supabase-event-request-repository";
import { SupabaseRegistrationRepository } from "@/adapters/outbound/supabase/supabase-registration-repository";
import { SupabaseMemberDirectory } from "@/adapters/outbound/supabase/supabase-member-directory";
import { SupabaseAuthAdapter } from "@/adapters/outbound/supabase/supabase-auth-adapter";
import { SupabaseUserRepository } from "@/adapters/outbound/supabase/supabase-user-repository";
import { systemClock } from "@/adapters/outbound/system/system-clock";
import type { ListEventsOpenForRegistration } from "@/core/ports/inbound/list-events-open-for-registration";
import type { Login } from "@/core/ports/inbound/login";
import type { DiscardEventRequestDraft } from "@/core/ports/inbound/discard-event-request-draft";
import type { RegisterForEvent } from "@/core/ports/inbound/register-for-event";
import type { SaveEventRequestDraft } from "@/core/ports/inbound/save-event-request-draft";
import type { SendConnectionRequest } from "@/core/ports/inbound/send-connection-request";
import type { SubmitEventRequest } from "@/core/ports/inbound/submit-event-request";
import type { ViewEventForRegistration } from "@/core/ports/inbound/view-event-for-registration";
import type { ViewEventRequest } from "@/core/ports/inbound/view-event-request";
import type { ViewMyEventRequests } from "@/core/ports/inbound/view-my-event-requests";
import type { ViewOrganisationEventRequests } from "@/core/ports/inbound/view-organisation-event-requests";
import type { ViewRegistration } from "@/core/ports/inbound/view-registration";
import type { WithdrawRegistration } from "@/core/ports/inbound/withdraw-registration";
import type { EventCatalogue } from "@/core/ports/outbound/event-catalogue";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";
import type { RegistrationRepository } from "@/core/ports/outbound/registration-repository";
import { ListEventsOpenForRegistrationUseCase } from "@/core/use-cases/list-events-open-for-registration";
import { LoginUseCase } from "@/core/use-cases/login";
import { DiscardEventRequestDraftUseCase } from "@/core/use-cases/discard-event-request-draft";
import { RegisterForEventUseCase } from "@/core/use-cases/register-for-event";
import { SaveEventRequestDraftUseCase } from "@/core/use-cases/save-event-request-draft";
import { SendConnectionRequestUseCase } from "@/core/use-cases/send-connection-request";
import { SubmitEventRequestUseCase } from "@/core/use-cases/submit-event-request";
import { ViewEventForRegistrationUseCase } from "@/core/use-cases/view-event-for-registration";
import { ViewEventRequestUseCase } from "@/core/use-cases/view-event-request";
import { ViewMyEventRequestsUseCase } from "@/core/use-cases/view-my-event-requests";
import { ViewOrganisationEventRequestsUseCase } from "@/core/use-cases/view-organisation-event-requests";
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
export async function buildSendConnectionRequest(): Promise<SendConnectionRequest> {
  const client = await createSupabaseServerClient();

  return new SendConnectionRequestUseCase({
    connections: new SupabaseConnectionRepository(client),
    members: new SupabaseMemberDirectory(client),
    notifier: new LoggingNotifier(),
    clock: systemClock,
  });
}

/**
 * Whether a Supabase project is configured for this deployment.
 *
 * Reading `process.env` is ambient outside state, and the composition root is
 * where the architecture puts it. The team has no project yet, so without one
 * the attendee pages fall back to seeded in-memory adapters -- the same
 * classes the use-case tests run against, obeying the same ports.
 */
function hasSupabaseProject(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

async function attendeeAdapters(): Promise<{
  events: EventCatalogue;
  registrations: RegistrationRepository;
}> {
  if (!hasSupabaseProject()) {
    return { events: demoEventCatalogue, registrations: demoRegistrationRepository };
  }

  const client = await createSupabaseServerClient();
  return {
    events: new SupabaseEventCatalogue(client),
    registrations: new SupabaseRegistrationRepository(client),
  };
}

export async function buildListEventsOpenForRegistration(): Promise<ListEventsOpenForRegistration> {
  const { events } = await attendeeAdapters();

  return new ListEventsOpenForRegistrationUseCase({ events, clock: systemClock });
}

export async function buildViewEventForRegistration(): Promise<ViewEventForRegistration> {
  const { events } = await attendeeAdapters();

  return new ViewEventForRegistrationUseCase({ events, clock: systemClock });
}

export async function buildRegisterForEvent(): Promise<RegisterForEvent> {
  const { events, registrations } = await attendeeAdapters();

  return new RegisterForEventUseCase({ events, registrations, clock: systemClock });
}

export async function buildViewRegistration(): Promise<ViewRegistration> {
  const { events, registrations } = await attendeeAdapters();

  return new ViewRegistrationUseCase({ events, registrations });
}

/**
 * Event requests, from the Supabase project when there is one.
 *
 * The in-memory fallback is the same class the use-case tests run against, so
 * the organiser screens work on a fresh clone with no project configured --
 * submissions just do not survive a restart. Both obey the same port, which is
 * the only reason this substitution is safe.
 */
async function eventRequestAdapters(): Promise<EventRequestRepository> {
  if (!hasSupabaseProject()) {
    return demoEventRequestRepository;
  }

  return new SupabaseEventRequestRepository(await createSupabaseServerClient());
}

export async function buildSubmitEventRequest(): Promise<SubmitEventRequest> {
  return new SubmitEventRequestUseCase({
    eventRequests: await eventRequestAdapters(),
    clock: systemClock,
  });
}

export async function buildSaveEventRequestDraft(): Promise<SaveEventRequestDraft> {
  return new SaveEventRequestDraftUseCase({
    eventRequests: await eventRequestAdapters(),
  });
}

export async function buildDiscardEventRequestDraft(): Promise<DiscardEventRequestDraft> {
  return new DiscardEventRequestDraftUseCase({
    eventRequests: await eventRequestAdapters(),
  });
}

export async function buildViewMyEventRequests(): Promise<ViewMyEventRequests> {
  return new ViewMyEventRequestsUseCase({ eventRequests: await eventRequestAdapters() });
}

export async function buildViewEventRequest(): Promise<ViewEventRequest> {
  return new ViewEventRequestUseCase({ eventRequests: await eventRequestAdapters() });
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

export async function buildWithdrawRegistration(): Promise<WithdrawRegistration> {
  const { events, registrations } = await attendeeAdapters();

  return new WithdrawRegistrationUseCase({ events, registrations });
}

/**
 * Every event request in the caller's client organisation, from the Supabase
 * project when there is one.
 *
 * The in-memory fallback (`organiser-demo-seed.ts`) is seeded across two
 * client organisations, so the "Viewing as" switcher on the organiser page
 * can demonstrate both "colleagues in my organisation" and "cannot see an
 * unrelated organisation" without a database.
 */
export async function buildViewOrganisationEventRequests(): Promise<ViewOrganisationEventRequests> {
  const eventRequests = hasSupabaseProject()
    ? new SupabaseEventRequestRepository(await createSupabaseServerClient())
    : demoOrganisationEventRequestRepository;

  return new ViewOrganisationEventRequestsUseCase({ eventRequests });
}

export async function buildLogin(): Promise<Login> {
  return new LoginUseCase({
    auth: new SupabaseAuthAdapter(),
    users: new SupabaseUserRepository(),
  });
}
