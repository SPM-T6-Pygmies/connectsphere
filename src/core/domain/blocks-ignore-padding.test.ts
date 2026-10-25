import { describe, expect, it } from "vitest";

import { blockedTimes } from "./booking";
import { bookingsToFlagForBlock, type FlaggableBooking } from "./booking-review-flag";
import { paddedWindows } from "./padded-window";
import { slotCodesFor } from "./slot-grid";
import { toMinutes } from "./time-of-day";
import { venueId } from "./venue";
import type { VenueUnavailabilityEntry } from "./venue-unavailability";

// SPM-23 AC9: a block ignores setup and turnaround. Main Hall is set up in 30 minutes and reset in
// 45, so a 10:00-12:00 event occupies 09:30-12:45; a block over only that setup or turnaround,
// and not the event, neither flags the event nor refuses a request for it.

const MAIN_HALL = venueId("5");
const DAY = "2026-12-16";
const NOW = new Date("2026-12-01T10:00:00+08:00");
const HALL_BUFFERS = { setup: 30, turnaround: 45 };
const EVENT = { date: DAY, start: "10:00", end: "12:00" };

function slotsOf(start: string, end: string) {
  return slotCodesFor({ start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 }).map((slot) => ({ date: DAY, slot }));
}

function blockOver(start: string, end: string): VenueUnavailabilityEntry {
  return {
    id: "7",
    venueId: MAIN_HALL,
    venueLocation: "Main Hall",
    startDate: DAY,
    endDate: DAY,
    reason: "Maintenance",
    note: null,
    slots: slotsOf(start, end),
    status: "In force",
    recordedByName: "Test Venue Staff",
    recordedAt: "2026-12-01T02:00:00.000Z",
    liftedByName: null,
    liftedAt: null,
  };
}

const confirmed: FlaggableBooking = {
  id: "812",
  venueId: MAIN_HALL,
  status: "Confirmed",
  holdExpiresAt: null,
  slots: slotsOf("10:00", "12:00"),
};

describe("a block ignores setup and turnaround (SPM-23 AC9)", () => {
  it("the event does occupy 09:30-12:45, so the cases below are about the padding, not its absence", () => {
    expect(paddedWindows(EVENT, HALL_BUFFERS)).toEqual([{ date: DAY, start: "09:30", end: "12:45" }]);
  });

  it("does not flag a Confirmed booking for a block over only its setup (09:30-10:00)", () => {
    expect(bookingsToFlagForBlock(blockOver("09:30", "10:00"), [confirmed], NOW)).toEqual([]);
  });

  it("does not flag it for a block over only its turnaround (12:00-12:45)", () => {
    expect(bookingsToFlagForBlock(blockOver("12:00", "12:45"), [confirmed], NOW)).toEqual([]);
  });

  it("still flags it for a block over the event itself, here the first quarter hour (10:00-10:15)", () => {
    expect(bookingsToFlagForBlock(blockOver("10:00", "10:15"), [confirmed], NOW)).toHaveLength(1);
  });

  it("does not refuse a request for the event for a block over only its setup or turnaround", () => {
    const setupBlock = slotsOf("09:30", "10:00");
    const turnaroundBlock = slotsOf("12:00", "12:45");

    expect(blockedTimes([EVENT], setupBlock)).toEqual([]);
    expect(blockedTimes([EVENT], turnaroundBlock)).toEqual([]);
  });

  it("still refuses a request that shares time with a block, naming only the shared time", () => {
    expect(blockedTimes([EVENT], slotsOf("11:30", "13:00"))).toEqual([{ date: DAY, start: "11:30", end: "12:00" }]);
  });
});
