import { eventId, type Event, type EventId, type EventStatus } from "@/core/domain/event";
import { joinSlots, type TimeRangeOnDate } from "@/core/domain/event-times";

import { toDate } from "./booking-mapper";

/**
 * The database's shape, named honestly and kept in the adapter.
 *
 * This is the team's schema, not one chosen for this application: singular
 * table names, bigint keys, Title Case status values and calendar dates for the
 * registration window. Every one of those disagreements with the domain is
 * reconciled here, which is the whole reason an adapter exists.
 *
 * The embedded booking is how an event reaches its venue: the domain model
 * draws no direct edge between them, so the join lives here rather than
 * becoming a second port and an N+1.
 */
export interface EventRow {
  event_id: number;
  name: string;
  description: string | null;
  status: string;
  event_capacity: number | null;
  registration_enabled_flag: boolean;
  registration_open_date: string | null;
  registration_close_date: string | null;
  booking: { status: string; venue: { location: string } | null }[];
}

/**
 * `booking` carries two foreign keys to `venue` -- the booked one and a
 * suggested alternative -- so PostgREST cannot guess which to embed and refuses
 * the ambiguous form. Naming the constraint is what picks the booked venue.
 *
 * These are exactly the columns granted to `anon`; asking for any other is a
 * 401 rather than a leak, which is the point of the column-level grants.
 */
export const EVENT_COLUMNS =
  "event_id, name, description, status, event_capacity, " +
  "registration_enabled_flag, registration_open_date, registration_close_date, " +
  "booking(status, venue!booking_venue_id_fkey(location))";

/**
 * The domain's `EventId` is an opaque string, which is what keeps the core from
 * knowing that this store numbers its rows. Turning it back into a key is this
 * adapter's job, and an id that was never one of ours is simply not found --
 * a hand-typed URL is a miss, not a failure.
 */
export function toKey(id: EventId): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

/** Exactly the five values `event_status_chk` allows, and nothing else. */
const STATUSES: Readonly<Record<string, EventStatus>> = {
  Planning: "planning",
  Blocked: "blocked",
  Confirmed: "confirmed",
  Completed: "completed",
  Cancelled: "cancelled",
};

function toStatus(raw: string): EventStatus {
  const status = STATUSES[raw];
  if (status === undefined) {
    // Data crossing inward is untrusted too, even from our own database.
    throw new Error(`Unknown event status "${raw}" in the event table.`);
  }
  return status;
}

/**
 * Singapore is the only timezone this system serves (#36).
 *
 * The stored window is a pair of calendar dates, so somebody has to say which
 * instants "the 1st" and "the 30th" mean, and the domain must not: it compares
 * instants and holds no opinion about calendars. Both bounds are inclusive, to
 * match `isOpenForRegistration`, so the closing date expands to the last
 * millisecond of that day rather than its start.
 *
 * A fixed +08:00 offset is exact rather than a simplification -- Singapore has
 * observed no daylight saving since 1935.
 */
function openingInstant(date: string): Date {
  return new Date(`${date}T00:00:00.000+08:00`);
}

function closingInstant(date: string): Date {
  return new Date(`${date}T23:59:59.999+08:00`);
}

/**
 * A left embed rather than an inner join, so a confirmed event whose venue is
 * still being arranged still lists -- with no venue rather than not at all.
 */
function venueOf(row: EventRow): string | null {
  const confirmed = row.booking.find((booking) => booking.status === "Confirmed");
  return confirmed?.venue?.location ?? null;
}

/**
 * One 15-minute `event_slot` row as the event reads report it (SPM-326):
 * `time` columns arrive as `HH:MM:SS`, and the last slot of a day ends `24:00:00`.
 */
export interface EventSlotTimeRow {
  date: string;
  start: string;
  end: string;
}

/** One row of `confirmed_event_slots()`, which answers for many events at once. */
export interface EventSlotRow extends EventSlotTimeRow {
  event_id: number;
}

/** The rows joined into the start and end times people read. */
export function toEventTimes(rows: readonly EventSlotTimeRow[]): TimeRangeOnDate[] {
  return joinSlots(
    rows.map((row) => ({ date: toDate(row.date), start: row.start.slice(0, 5), end: row.end.slice(0, 5) })),
  );
}

/** Each event's start and end times, keyed by event id. */
export function timesByEvent(rows: readonly EventSlotRow[]): Map<number, TimeRangeOnDate[]> {
  const byEvent = new Map<number, EventSlotRow[]>();
  for (const row of rows) {
    byEvent.set(row.event_id, [...(byEvent.get(row.event_id) ?? []), row]);
  }
  return new Map([...byEvent].map(([id, eventRows]) => [id, toEventTimes(eventRows)]));
}

/** `times` must be non-empty: an event with none cannot be a domain `Event`. */
export function toDomain(row: EventRow, times: readonly TimeRangeOnDate[]): Event {
  return {
    id: eventId(String(row.event_id)),
    name: row.name,
    description: row.description,
    status: toStatus(row.status),
    times,
    venueName: venueOf(row),
    capacity: row.event_capacity,
    registrationEnabled: row.registration_enabled_flag,
    registrationOpensAt: row.registration_open_date
      ? openingInstant(row.registration_open_date)
      : null,
    registrationClosesAt: row.registration_close_date
      ? closingInstant(row.registration_close_date)
      : null,
  };
}
