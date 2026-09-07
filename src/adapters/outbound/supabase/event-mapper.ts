import { eventId, type Event, type EventStatus } from "@/core/domain/event";

/**
 * The database's shape, named honestly and kept in the adapter.
 *
 * The embedded booking is how an event reaches its venue: the domain model
 * draws no direct edge between them, so the join lives here rather than
 * becoming a second port and an N+1.
 */
export interface EventRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  event_capacity: number | null;
  registration_enabled: boolean;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  bookings: { status: string; venues: { location: string } | null }[];
}

export const EVENT_COLUMNS =
  "id, name, description, status, starts_at, ends_at, event_capacity, " +
  "registration_enabled, registration_opens_at, registration_closes_at, " +
  "bookings(status, venues(location))";

const STATUSES: readonly string[] = [
  "draft",
  "approved",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

function toStatus(raw: string): EventStatus {
  if (!STATUSES.includes(raw)) {
    // Data crossing inward is untrusted too, even from our own database.
    throw new Error(`Unknown event status "${raw}" in the events table.`);
  }
  return raw as EventStatus;
}

/**
 * A left embed rather than an inner join, so a confirmed event whose venue is
 * still being arranged still lists -- with no venue rather than not at all.
 */
function venueOf(row: EventRow): string | null {
  const confirmed = row.bookings.find((booking) => booking.status === "confirmed");
  return confirmed?.venues?.location ?? null;
}

export function toDomain(row: EventRow): Event {
  return {
    id: eventId(row.id),
    name: row.name,
    description: row.description,
    status: toStatus(row.status),
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    venueName: venueOf(row),
    capacity: row.event_capacity,
    registrationEnabled: row.registration_enabled,
    registrationOpensAt: row.registration_opens_at ? new Date(row.registration_opens_at) : null,
    registrationClosesAt: row.registration_closes_at ? new Date(row.registration_closes_at) : null,
  };
}
