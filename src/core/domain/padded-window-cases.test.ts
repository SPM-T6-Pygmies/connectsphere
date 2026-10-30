import { describe, expect, it } from "vitest";

import cases from "../../../scripts/seed-venue-padding/cases.json";
import { paddedClashingTimes, type BookingStatus } from "./booking";
import { paddedClashes } from "./padded-window";
import { toMinutes } from "./time-of-day";
import { venueId, type Venue } from "./venue";
import { searchVenues } from "./venue-search";

/**
 * SPM-19 AC7: the padded-window rule is written twice, here and in the database function
 * `booking_padded_clashes`. These cases are the one list both are held to: this test runs them
 * through the code, and `scripts/seed-venue-padding/same-answers.mjs` runs them through the
 * database, so a change to one copy that the other does not follow fails.
 */
const BUFFERS: Record<string, { setup: number; turnaround: number }> = {
  "Main Hall": { setup: 30, turnaround: 45 },
  Studio: { setup: 0, turnaround: 0 },
  "Seminar Room 2-1": { setup: 0, turnaround: 0 },
};

describe("the padded-window cases the database is also held to (SPM-19)", () => {
  it.each(cases)("AC7: $label", ({ venue, existing, request, clashes }) => {
    const found = paddedClashes(
      [{ date: request.date, start: request.start, end: request.end }],
      [{ eventName: "Other event", times: [{ date: existing.date, start: existing.start, end: existing.end }] }],
      BUFFERS[venue],
    );

    expect(found.map(({ date, start, end }) => ({ date, start, end }))).toEqual(clashes);
  });
});

describe("the padded-window cases, as a coordinator submits them (SPM-475)", () => {
  // A hold in the list is live: it lapses a day after NOW, as `same-answers.mjs` gives it a day.
  const NOW = new Date("2026-10-01T09:00:00+08:00");

  it.each(cases)("$label", ({ venue, existing, request, clashes }) => {
    const found = paddedClashingTimes(
      [{ date: request.date, start: request.start, end: request.end }],
      [
        {
          date: existing.date,
          start: existing.start,
          end: existing.end,
          status: existing.status as BookingStatus,
          holdExpiresAt: existing.status === "Tentative Hold" ? new Date("2026-10-02T09:00:00+08:00") : null,
        },
      ],
      BUFFERS[venue],
      NOW,
    );

    expect(found).toEqual(clashes);
  });
});

describe("the padded-window cases, as a venue search reads them (SPM-250)", () => {
  // Every case is in December 2026; the venue is open all day, so only the bookings decide.
  const TODAY = "2026-12-01";

  /** `time` on `date` in Singapore, 24:00 being the next midnight. */
  function instant(date: string, time: string): Date {
    return new Date(Date.parse(`${date}T00:00:00+08:00`) + (toMinutes(time) ?? 0) * 60_000);
  }

  it.each(cases)("$label", ({ venue, existing, request, clashes }) => {
    const hall: Venue = {
      id: venueId("1"),
      location: venue,
      facilities: null,
      accessibility: null,
      openingHours: [{ start: "00:00", end: "24:00" }],
      capacity: 100,
      bookingHorizonDays: 60,
      layouts: [],
      setupMinutes: BUFFERS[venue].setup,
      turnaroundMinutes: BUFFERS[venue].turnaround,
    };
    const busy = [
      {
        venueId: hall.id,
        startsAt: instant(existing.date, existing.start),
        endsAt: instant(existing.date, existing.end),
        kind: "booking" as const,
      },
    ];
    const search = { layout: null, attendance: null, facilities: [], accessibility: [], window: request };

    const { venues } = searchVenues([hall], search, busy, TODAY, "Asia/Singapore");

    expect(venues.length === 0).toBe(clashes.length > 0);
  });
});
