import { describe, expect, it } from "vitest";

import type { BookingSlot, BookingStatus, OccupiedSlot } from "./booking";
import { InvalidCalendarRangeError } from "./errors";
import type { UnavailabilityReason } from "./venue-unavailability";
import {
  CALENDAR_MAX_DAYS,
  calendarDays,
  deriveVenueCalendar,
  type CalendarBlock,
  type CalendarSlotStatus,
} from "./venue-calendar";

const DAY = "2026-11-02";
const NOW = new Date("2026-10-13T09:00:00+08:00");
const ALL_SLOTS: readonly BookingSlot[] = ["AM", "PM", "Night"];

function occupied(
  slot: BookingSlot,
  status: BookingStatus,
  holdExpiresAt: Date | null = null,
): OccupiedSlot {
  return { date: DAY, slot, status, holdExpiresAt };
}

function block(
  slot: BookingSlot,
  reason: UnavailabilityReason = "Maintenance",
  note: string | null = null,
): CalendarBlock {
  return { date: DAY, slot, reason, note };
}

function statuses(input: {
  offeredSlots?: readonly BookingSlot[];
  occupied?: readonly OccupiedSlot[];
  blocked?: readonly CalendarBlock[];
}): Record<BookingSlot, CalendarSlotStatus> {
  const [day] = deriveVenueCalendar({
    days: [DAY],
    offeredSlots: input.offeredSlots ?? ALL_SLOTS,
    occupied: input.occupied ?? [],
    blocked: input.blocked ?? [],
    now: NOW,
  });
  return Object.fromEntries(day.slots.map((s) => [s.slot, s.status])) as Record<
    BookingSlot,
    CalendarSlotStatus
  >;
}

describe("deriveVenueCalendar (SPM-152)", () => {
  it("shows every slot available when nothing is booked or blocked", () => {
    expect(statuses({})).toEqual({ AM: "available", PM: "available", Night: "available" });
  });

  it("returns one day per date given, each with AM, PM and Night in order", () => {
    const days = deriveVenueCalendar({
      days: ["2026-11-02", "2026-11-03"],
      offeredSlots: ALL_SLOTS,
      occupied: [],
      blocked: [],
      now: NOW,
    });

    expect(days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(days[0].slots.map((s) => s.slot)).toEqual(["AM", "PM", "Night"]);
  });

  it("shows a Confirmed booking's slot as booked, and only that slot", () => {
    expect(statuses({ occupied: [occupied("PM", "Confirmed")] })).toEqual({
      AM: "available",
      PM: "booked",
      Night: "available",
    });
  });

  it("does not carry a booking onto another date", () => {
    const [day] = deriveVenueCalendar({
      days: ["2026-11-03"],
      offeredSlots: ALL_SLOTS,
      occupied: [occupied("PM", "Confirmed")],
      blocked: [],
      now: NOW,
    });

    expect(day.slots.every((s) => s.status === "available")).toBe(true);
  });

  it.each(["Requested", "Rejected", "Released", "Cancelled"] as const)(
    "leaves a slot available under a %s booking, which holds nothing",
    (status) => {
      expect(statuses({ occupied: [occupied("AM", status)] }).AM).toBe("available");
    },
  );

  it("shows a slot blocked by Venue Staff as blocked", () => {
    expect(statuses({ blocked: [block("Night")] }).Night).toBe("blocked");
  });

  it("shows blocked, not booked, when a block covers a Confirmed booking", () => {
    expect(
      statuses({ occupied: [occupied("AM", "Confirmed")], blocked: [block("AM")] }).AM,
    ).toBe("blocked");
  });

  it("shows a slot the venue does not offer as not offered", () => {
    expect(statuses({ offeredSlots: ["AM", "PM"] }).Night).toBe("notOffered");
  });

  it("still shows a booking on a slot the venue no longer offers", () => {
    expect(
      statuses({ offeredSlots: ["AM"], occupied: [occupied("PM", "Confirmed")] }).PM,
    ).toBe("booked");
  });
});

describe("deriveVenueCalendar holds (SPM-43)", () => {
  function heldSlot(holdExpiresAt: Date | null) {
    const [day] = deriveVenueCalendar({
      days: [DAY],
      offeredSlots: ALL_SLOTS,
      occupied: [occupied("AM", "Tentative Hold", holdExpiresAt)],
      blocked: [],
      now: NOW,
    });
    return day.slots[0];
  }

  it("shows an unexpired hold as held, with its expiry", () => {
    const expiry = new Date(NOW.getTime() + 60_000);

    expect(heldSlot(expiry)).toEqual({
      slot: "AM",
      status: "held",
      holdExpiresAt: expiry,
      reasons: [],
      notes: [],
    });
  });

  it("shows a hold that expires exactly now as available", () => {
    expect(heldSlot(new Date(NOW)).status).toBe("available");
  });

  it("shows an expired hold as available", () => {
    expect(heldSlot(new Date(NOW.getTime() - 60_000))).toEqual({
      slot: "AM",
      status: "available",
      holdExpiresAt: null,
      reasons: [],
      notes: [],
    });
  });

  it("shows a hold with no expiry as held, as the clash rule does", () => {
    expect(heldSlot(null)).toEqual({
      slot: "AM",
      status: "held",
      holdExpiresAt: null,
      reasons: [],
      notes: [],
    });
  });
});

describe("deriveVenueCalendar block reasons (SPM-153)", () => {
  function slotsFor(blocked: readonly CalendarBlock[]) {
    const [day] = deriveVenueCalendar({
      days: [DAY],
      offeredSlots: ALL_SLOTS,
      occupied: [],
      blocked,
      now: NOW,
    });
    return Object.fromEntries(day.slots.map((s) => [s.slot, s]));
  }

  it("gives a blocked slot the reason Venue Staff recorded", () => {
    expect(slotsFor([block("PM", "Renovation")]).PM.reasons).toEqual(["Renovation"]);
  });

  it("gives every reason when overlapping blocks cover one slot", () => {
    expect(
      slotsFor([block("PM", "Renovation"), block("PM", "Safety")]).PM.reasons,
    ).toEqual(["Renovation", "Safety"]);
  });

  it("lists a reason once when two blocks give the same one", () => {
    expect(
      slotsFor([block("PM", "Maintenance"), block("PM", "Maintenance")]).PM.reasons,
    ).toEqual(["Maintenance"]);
  });

  it("gives no reason, without erroring, on a slot that is not blocked", () => {
    const slots = slotsFor([block("PM")]);

    expect(slots.AM.reasons).toEqual([]);
    expect(slots.Night.reasons).toEqual([]);
  });
});

describe("calendarDays (SPM-43)", () => {
  it("lists every day from the start to the end, both included", () => {
    expect(calendarDays("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("allows a one-day range", () => {
    expect(calendarDays(DAY, DAY)).toEqual([DAY]);
  });

  it("refuses an end before the start", () => {
    expect(() => calendarDays("2026-11-02", "2026-11-01")).toThrow(InvalidCalendarRangeError);
  });

  it("refuses a date that does not exist", () => {
    expect(() => calendarDays("2026-02-30", "2026-03-01")).toThrow(InvalidCalendarRangeError);
  });

  it(`allows exactly ${CALENDAR_MAX_DAYS} days and refuses one more`, () => {
    expect(calendarDays("2026-12-01", "2026-12-31")).toHaveLength(CALENDAR_MAX_DAYS);
    expect(() => calendarDays("2026-12-01", "2027-01-01")).toThrow(InvalidCalendarRangeError);
  });
});

describe("deriveVenueCalendar block notes (SPM-43)", () => {
  function pm(blocked: readonly CalendarBlock[]) {
    const [day] = deriveVenueCalendar({
      days: [DAY],
      offeredSlots: ALL_SLOTS,
      occupied: [],
      blocked,
      now: NOW,
    });
    return day.slots[1];
  }

  it("gives the note Venue Staff wrote on an Other block", () => {
    expect(pm([block("PM", "Other", "Terrace closed for resurfacing")]).notes).toEqual([
      "Terrace closed for resurfacing",
    ]);
  });

  it("gives every note when two Other blocks cover one slot, each once", () => {
    expect(
      pm([
        block("PM", "Other", "Resurfacing"),
        block("PM", "Other", "Film shoot"),
        block("PM", "Other", "Resurfacing"),
      ]).notes,
    ).toEqual(["Resurfacing", "Film shoot"]);
  });

  it("gives no note for an Other block without one", () => {
    const slot = pm([block("PM", "Other")]);

    expect(slot.reasons).toEqual(["Other"]);
    expect(slot.notes).toEqual([]);
  });

  it("gives no note on a slot that is not blocked", () => {
    expect(pm([]).notes).toEqual([]);
  });
});
