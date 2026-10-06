import { describe, expect, it } from "vitest";

import {
  SAFETY_OFFICER,
  safetyCheckReview,
  safetyCheckStore,
} from "@/adapters/outbound/in-memory/safety-check-fixture";
import { EventNotFoundError, NotSafetyOfficerError } from "@/core/domain/errors";

import { ViewSafetyCheckUseCase } from "./view-safety-check";

function view(seed = [safetyCheckReview()]) {
  return new ViewSafetyCheckUseCase({ safetyChecks: safetyCheckStore(seed) });
}

describe("ViewSafetyCheckUseCase (SPM-260)", () => {
  it("AC1: shows the event, its confirmed venues with layout capacity, its equipment, and that it awaits a check", async () => {
    await expect(view().execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1" })).resolves.toEqual({
      eventId: "event-1",
      eventName: "Founders' Gala Dinner",
      preferredDate: "2026-12-12",
      expectedAttendance: 220,
      accessibilityRequirements: "Step-free route to the stage",
      venues: [
        { venueName: "Grand Ballroom", layoutName: "Banquet", layoutCapacity: 180, accessibility: "Lift to level 2" },
      ],
      equipment: [{ item: "Wireless microphone", quantityRequested: 2, quantityReserved: 2 }],
      checks: [],
      awaitsCheck: true,
    });
  });

  it("AC5, AC6: shows the recorded checks and no longer awaits one", async () => {
    const checked = safetyCheckReview({
      candidate: { ...safetyCheckReview().candidate, checked: true },
      checks: [
        {
          outcome: "Rejected",
          comments: "Banquet layout holds 180; 220 expected.",
          checkedByName: "Test Safety Officer",
          checkedAt: "2026-10-05T08:00:00.000Z",
        },
      ],
    });

    const result = await view([checked]).execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1" });

    expect(result.awaitsCheck).toBe(false);
    expect(result.checks).toEqual(checked.checks);
  });

  it("AC7: refuses anyone who is not a Safety Officer", async () => {
    await expect(view().execute({ userAccountId: "venue-1", eventId: "event-1" })).rejects.toBeInstanceOf(
      NotSafetyOfficerError,
    );
  });

  it("AC7: an unknown event is not found", async () => {
    await expect(view().execute({ userAccountId: SAFETY_OFFICER, eventId: "event-9" })).rejects.toBeInstanceOf(
      EventNotFoundError,
    );
  });
});
