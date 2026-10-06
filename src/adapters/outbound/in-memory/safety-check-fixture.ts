import { eventId } from "@/core/domain/event";
import type { SafetyCheckReview } from "@/core/ports/outbound/safety-check-repository";

import { FixedClock } from "./fixed-clock";
import { InMemorySafetyCheckRepository } from "./in-memory-safety-check-repository";

export const SAFETY_OFFICER = "safety-1";
export const COORDINATOR = "coordinator-1";
export const NOW = new Date("2026-10-06T09:30:00.000Z");

/** SPM-260: an event awaiting its safety check, as the Safety Officer reviews it. */
export function safetyCheckReview(overrides: Partial<SafetyCheckReview> = {}): SafetyCheckReview {
  return {
    candidate: {
      event: {
        id: eventId("event-1"),
        name: "Founders' Gala Dinner",
        status: "Planning",
        preferredDate: "2026-12-12",
        expectedAttendance: 220,
      },
      bookings: [{ status: "Confirmed", venueName: "Grand Ballroom" }],
      equipmentLines: [{ state: "Reserved", quantityRequested: 2, quantityReserved: 2 }],
      checked: false,
    },
    accessibilityRequirements: "Step-free route to the stage",
    coordinatorUserAccountId: COORDINATOR,
    venues: [
      { venueName: "Grand Ballroom", layoutName: "Banquet", layoutCapacity: 180, accessibility: "Lift to level 2" },
    ],
    equipment: [{ item: "Wireless microphone", quantityRequested: 2, quantityReserved: 2 }],
    checks: [],
    ...overrides,
  };
}

/** The store, with `safety-1` and `safety-2` as Safety Officers. */
export function safetyCheckStore(seed: readonly SafetyCheckReview[] = [safetyCheckReview()]) {
  return new InMemorySafetyCheckRepository(
    seed,
    { [SAFETY_OFFICER]: "Test Safety Officer", "safety-2": "Test Safety Officer 2" },
    new FixedClock(NOW),
  );
}
