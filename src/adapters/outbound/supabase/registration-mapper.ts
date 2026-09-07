import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId } from "@/core/domain/event";
import {
  registrationId,
  type Registration,
  type RegistrationStatus,
} from "@/core/domain/registration";

export interface RegistrationRow {
  id: string;
  event_id: string;
  attendee_name: string;
  attendee_email: string;
  status: string;
  registered_at: string;
}

export const REGISTRATION_COLUMNS =
  "id, event_id, attendee_name, attendee_email, status, registered_at";

const STATUSES: readonly string[] = ["registered", "withdrawn"];

function toStatus(raw: string): RegistrationStatus {
  if (!STATUSES.includes(raw)) {
    throw new Error(`Unknown registration status "${raw}" in the registrations table.`);
  }
  return raw as RegistrationStatus;
}

export function toDomain(row: RegistrationRow): Registration {
  return {
    id: registrationId(row.id),
    eventId: eventId(row.event_id),
    attendeeName: attendeeName(row.attendee_name),
    attendeeEmail: attendeeEmail(row.attendee_email),
    status: toStatus(row.status),
    registeredAt: new Date(row.registered_at),
  };
}

export function toRow(registration: Registration): RegistrationRow {
  return {
    id: registration.id,
    event_id: registration.eventId,
    attendee_name: registration.attendeeName,
    attendee_email: registration.attendeeEmail,
    status: registration.status,
    registered_at: registration.registeredAt.toISOString(),
  };
}
