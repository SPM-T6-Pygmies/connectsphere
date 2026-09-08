import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId } from "@/core/domain/event";
import {
  registrationId,
  type Registration,
  type RegistrationId,
  type RegistrationStatus,
} from "@/core/domain/registration";

/**
 * What `attendee_live_registration` returns.
 *
 * Not the `registration` table's shape: `anon` has no grant on that table, so
 * this row is whatever the function chose to hand back. It carries no column
 * the caller did not already supply, which is what stops a publishable key from
 * becoming a handle on the attendee list.
 *
 * `registration_reference` rather than `registration_id`: the bigint primary
 * key belongs to the team's schema, and the domain's id is the reference this
 * application minted before the row existed.
 */
export interface RegistrationRow {
  registration_reference: string;
  event_id: number;
  attendee_name: string;
  attendee_email: string;
  status: string;
  registered_at: string;
}

const TO_DOMAIN: Readonly<Record<string, RegistrationStatus>> = {
  Registered: "registered",
  Withdrawn: "withdrawn",
};

/**
 * Release 1 produces only these two of the team's six statuses. The others --
 * waitlisting and the attendance states -- have no domain counterpart yet, so
 * meeting one is a genuine surprise rather than a case to quietly absorb.
 */
const TO_ROW: Readonly<Record<RegistrationStatus, string>> = {
  registered: "Registered",
  withdrawn: "Withdrawn",
};

function toStatus(raw: string): RegistrationStatus {
  const status = TO_DOMAIN[raw];
  if (status === undefined) {
    throw new Error(`Unknown registration status "${raw}" in the registration table.`);
  }
  return status;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A reference to the key the registration functions take, or `null`.
 *
 * The same job as `toKey` for events, and the same reasoning: an id that was
 * never one of ours is a miss, not a failure. Here it is not merely tidy --
 * `p_reference` is declared `uuid`, so handing Postgres a hand-typed
 * `/registrations/hello` raises 22P02 and surfaces as a 500 rather than the
 * 404 it should be.
 */
export function toReferenceKey(reference: RegistrationId): string | null {
  return UUID.test(reference) ? reference : null;
}

export function toDomain(row: RegistrationRow): Registration {
  return {
    id: registrationId(row.registration_reference),
    eventId: eventId(String(row.event_id)),
    attendeeName: attendeeName(row.attendee_name),
    attendeeEmail: attendeeEmail(row.attendee_email),
    status: toStatus(row.status),
    registeredAt: new Date(row.registered_at),
  };
}

/** The arguments `attendee_register` takes, named as the function names them. */
export function toRegisterArgs(registration: Registration, eventKey: number) {
  return {
    p_reference: registration.id,
    p_event_id: eventKey,
    p_name: registration.attendeeName,
    p_email: registration.attendeeEmail,
    p_status: TO_ROW[registration.status],
    p_registered_at: registration.registeredAt.toISOString(),
  };
}
