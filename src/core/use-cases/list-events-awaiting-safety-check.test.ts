import { describe, expect, it } from "vitest";

import { InMemorySafetyCheckCandidateRepository } from "@/adapters/outbound/in-memory/in-memory-safety-check-candidate-repository";
import { eventId } from "@/core/domain/event";
import type { SafetyCheckCandidate } from "@/core/domain/safety-check";

import { ListEventsAwaitingSafetyCheckUseCase } from "./list-events-awaiting-safety-check";

const SAFETY_OFFICER = { userAccountId: "safety-1" };

function candidate(overrides: Partial<SafetyCheckCandidate["event"]> = {}, ready = true): SafetyCheckCandidate {
  return {
    event: {
      id: eventId("event-1"),
      name: "Founders' Gala Dinner",
      status: "Planning",
      preferredDate: "2026-12-12",
      expectedAttendance: 120,
      ...overrides,
    },
    bookings: [
      { status: "Confirmed", venueName: "Sky Terrace" },
      { status: ready ? "Confirmed" : "Requested", venueName: "Grand Ballroom" },
    ],
    equipmentLines: [{ state: "Reserved", quantityRequested: 2, quantityReserved: 2 }],
    checked: false,
  };
}

function list(seed: readonly SafetyCheckCandidate[]) {
  return new ListEventsAwaitingSafetyCheckUseCase({
    candidates: new InMemorySafetyCheckCandidateRepository(seed),
  }).execute(SAFETY_OFFICER);
}

describe("ListEventsAwaitingSafetyCheckUseCase (SPM-259)", () => {
  it("AC5: shows each event's name, date, expected attendance and venues", async () => {
    const result = await list([candidate()]);

    expect(result.events).toEqual([
      {
        eventId: "event-1",
        eventName: "Founders' Gala Dinner",
        preferredDate: "2026-12-12",
        expectedAttendance: 120,
        venues: ["Grand Ballroom", "Sky Terrace"],
      },
    ]);
  });

  it("AC1, AC3: lists only the events awaiting a check, in the order the store gives them", async () => {
    const result = await list([
      candidate({ id: eventId("event-1"), name: "Annual Summit" }),
      candidate({ id: eventId("event-2"), name: "Product Launch" }, false),
      candidate({ id: eventId("event-3"), name: "Charity Run", preferredDate: null, expectedAttendance: null }),
    ]);

    expect(result.events.map((event) => [event.eventName, event.preferredDate, event.expectedAttendance])).toEqual([
      ["Annual Summit", "2026-12-12", 120],
      ["Charity Run", null, null],
    ]);
  });

  it("AC6: shows an empty list when nothing awaits a check", async () => {
    const result = await list([candidate({}, false)]);

    expect(result.events).toEqual([]);
  });
});
