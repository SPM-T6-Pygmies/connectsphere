import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId, type Event } from "@/core/domain/event";
import { registrationId, type Registration } from "@/core/domain/registration";

import { InMemoryEventCatalogue } from "./in-memory-event-catalogue";
import { InMemoryRegistrationRepository } from "./in-memory-registration-repository";

/**
 * Demonstration data for running the attendee pages without a database.
 *
 * The team has no Supabase project yet, so the composition root falls back to
 * these when the environment is not configured. The set is chosen to exercise
 * every branch of `isOpenForRegistration` and `isFull`: four events an
 * Attendee should see, and four they should not.
 *
 * Dates are relative to process start so the demo never goes stale.
 */
const DAY = 24 * 60 * 60 * 1000;
const SGT_OFFSET_HOURS = 8;
const START = Date.now();

function inDays(days: number): Date {
  return new Date(START + days * DAY);
}

/** A whole hour of Singapore time, `days` from now, so the demo reads plausibly. */
function inDaysAt(days: number, sgtHour: number): Date {
  const day = new Date(START + days * DAY);
  day.setUTCHours(sgtHour - SGT_OFFSET_HOURS, 0, 0, 0);
  return day;
}

const SUITE = "Innovation Suite, 81 Victoria Street";
const HALL = "Hall A, 60 Stamford Road";

function event(id: string, name: string, overrides: Partial<Event>): Event {
  return {
    id: eventId(id),
    name,
    description: null,
    status: "confirmed",
    startsAt: inDaysAt(14, 10),
    endsAt: inDaysAt(14, 17),
    venueName: SUITE,
    capacity: 120,
    registrationEnabled: true,
    registrationOpensAt: inDays(-7),
    registrationClosesAt: inDays(10),
    ...overrides,
  };
}

const OPEN_ROOMY = "1f0a2b3c-0001-4a00-8000-000000000001";
const OPEN_LAST_PLACE = "1f0a2b3c-0002-4a00-8000-000000000002";
const OPEN_FULL = "1f0a2b3c-0003-4a00-8000-000000000003";
const OPEN_UNCAPPED = "1f0a2b3c-0004-4a00-8000-000000000004";
const NOT_CONFIRMED = "1f0a2b3c-0005-4a00-8000-000000000005";
const REGISTRATION_DISABLED = "1f0a2b3c-0006-4a00-8000-000000000006";
const NOT_YET_OPEN = "1f0a2b3c-0007-4a00-8000-000000000007";
const ALREADY_CLOSED = "1f0a2b3c-0008-4a00-8000-000000000008";

const EVENTS: readonly Event[] = [
  event(OPEN_ROOMY, "Singapore AI & Robotics Demo Night", {
    description:
      "An evening of live demos from robotics and applied-AI teams, followed by open networking.",
    startsAt: inDaysAt(9, 19),
    endsAt: inDaysAt(9, 22),
    registrationClosesAt: inDays(8),
    venueName: HALL,
  }),
  event(OPEN_LAST_PLACE, "Venue Operations Walkthrough", {
    description: "A hands-on tour of setup, turnaround and equipment handling for event staff.",
    startsAt: inDaysAt(11, 9),
    endsAt: inDaysAt(11, 12),
    capacity: 3,
  }),
  event(OPEN_FULL, "Event Coordinator Masterclass", {
    description: "A full-day workshop on scheduling, arrangements and change impact.",
    startsAt: inDaysAt(16, 9),
    endsAt: inDaysAt(16, 18),
    capacity: 2,
  }),
  event(OPEN_UNCAPPED, "ConnectSphere Client Showcase", {
    description: "An open briefing on this year's programme. No registration ceiling.",
    startsAt: inDaysAt(21, 14),
    endsAt: inDaysAt(21, 17),
    capacity: null,
    venueName: HALL,
  }),

  // The four below must never reach an Attendee.
  event(NOT_CONFIRMED, "Quarterly Partner Forum (awaiting confirmation)", {
    status: "planning",
  }),
  event(REGISTRATION_DISABLED, "Board Strategy Offsite (no registration)", {
    registrationEnabled: false,
  }),
  event(NOT_YET_OPEN, "Year-End Celebration (registration not yet open)", {
    startsAt: inDaysAt(60, 18),
    endsAt: inDaysAt(60, 23),
    registrationOpensAt: inDays(20),
    registrationClosesAt: inDays(50),
  }),
  event(ALREADY_CLOSED, "Annual General Meeting (registration closed)", {
    startsAt: inDaysAt(3, 15),
    endsAt: inDaysAt(3, 17),
    registrationOpensAt: inDays(-30),
    registrationClosesAt: inDays(-1),
  }),
];

function taken(index: number, event: string, email: string): Registration {
  return {
    id: registrationId(`1f0a2b3c-9999-4a00-8000-00000000000${index}`),
    eventId: eventId(event),
    attendeeName: attendeeName("Seeded Attendee"),
    attendeeEmail: attendeeEmail(email),
    status: "registered",
    registeredAt: inDays(-2),
  };
}

const REGISTRATIONS: readonly Registration[] = [
  taken(1, OPEN_LAST_PLACE, "first@example.com"),
  taken(2, OPEN_LAST_PLACE, "second@example.com"),
  taken(3, OPEN_FULL, "third@example.com"),
  taken(4, OPEN_FULL, "fourth@example.com"),
];

/**
 * Module-level singletons, so a registration made in the browser survives to
 * the next request for as long as the dev server is running.
 */
export const demoEventCatalogue = new InMemoryEventCatalogue(EVENTS);
export const demoRegistrationRepository = new InMemoryRegistrationRepository(REGISTRATIONS);
