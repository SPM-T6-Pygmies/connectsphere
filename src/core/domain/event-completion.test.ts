import { describe, expect, it } from "vitest";

import type { CoordinatorEventStatus } from "./coordinator-event";
import { EventNotCompletableError, EventNotYetEndedError } from "./errors";
import {
  canComplete,
  completeEvent,
  eventEndsAt,
  type CompletableEvent,
} from "./event-completion";

/** Two slots on two days; the later one, 15 Oct Night, ends at midnight Singapore time. */
function event(overrides: Partial<CompletableEvent> = {}): CompletableEvent {
  return {
    status: "Confirmed",
    slots: [
      { date: "2026-10-14", slot: "AM" },
      { date: "2026-10-15", slot: "Night" },
    ],
    operationalNotes: null,
    ...overrides,
  };
}

const ENDS_AT = new Date("2026-10-16T00:00:00+08:00");
const JUST_BEFORE = new Date(ENDS_AT.getTime() - 1);
const JUST_AFTER = new Date(ENDS_AT.getTime() + 1);

describe("event completion (SPM-51)", () => {
  describe("eventEndsAt", () => {
    it("is the end of the latest slot, in Singapore time", () => {
      expect(eventEndsAt(event())).toEqual(ENDS_AT);
    });

    it("does not depend on the order the slots come in", () => {
      expect(
        eventEndsAt(
          event({
            slots: [
              { date: "2026-10-15", slot: "PM" },
              { date: "2026-10-15", slot: "Night" },
              { date: "2026-10-14", slot: "Night" },
            ],
          }),
        ),
      ).toEqual(ENDS_AT);
    });

    it("is unknown for an event with no slots", () => {
      expect(eventEndsAt(event({ slots: [] }))).toBeNull();
    });
  });

  describe("completeEvent", () => {
    it("AC1: completes a Confirmed event once it has ended", () => {
      expect(completeEvent(event(), JUST_AFTER)).toEqual({
        status: "Completed",
        operationalNotes: null,
      });
    });

    it("completes exactly when the last slot ends", () => {
      expect(completeEvent(event(), ENDS_AT).status).toBe("Completed");
    });

    it("refuses a millisecond before the last slot ends", () => {
      expect(() => completeEvent(event(), JUST_BEFORE)).toThrow(EventNotYetEndedError);
    });

    it("refuses while a later slot is still to come, even after an earlier one ended", () => {
      expect(() => completeEvent(event(), new Date("2026-10-14T13:00:00+08:00"))).toThrow(
        EventNotYetEndedError,
      );
    });

    it("refuses an event with no slots, whose end is unknown", () => {
      expect(() => completeEvent(event({ slots: [] }), JUST_AFTER)).toThrow(EventNotYetEndedError);
    });

    it.each<CoordinatorEventStatus>(["Planning", "Blocked", "Completed", "Cancelled"])(
      "refuses a %s event, naming its status",
      (status) => {
        expect(() => completeEvent(event({ status }), JUST_AFTER)).toThrow(
          new EventNotCompletableError(status),
        );
        expect(() => completeEvent(event({ status }), JUST_AFTER)).toThrow(status);
      },
    );

    it("checks the status before the end, so a Planning event is not told to wait", () => {
      expect(() => completeEvent(event({ status: "Planning" }), JUST_BEFORE)).toThrow(
        EventNotCompletableError,
      );
    });

    it("AC2: records the notes, trimmed", () => {
      expect(completeEvent(event(), JUST_AFTER, "  Ran 20 minutes over.  ").operationalNotes).toBe(
        "Ran 20 minutes over.",
      );
    });

    it("AC2: replaces notes the event already had", () => {
      expect(
        completeEvent(event({ operationalNotes: "Doors at 9." }), JUST_AFTER, "Doors at 9. Ran over.")
          .operationalNotes,
      ).toBe("Doors at 9. Ran over.");
    });

    it.each([
      ["no notes", undefined],
      ["empty notes", ""],
      ["blank notes", "   \n "],
    ])("keeps the existing notes with %s", (_label, notes) => {
      expect(
        completeEvent(event({ operationalNotes: "Doors at 9." }), JUST_AFTER, notes).operationalNotes,
      ).toBeNull();
    });

    it("treats notes identical to the existing ones as no change", () => {
      expect(
        completeEvent(event({ operationalNotes: "Doors at 9." }), JUST_AFTER, " Doors at 9. ")
          .operationalNotes,
      ).toBeNull();
    });
  });

  describe("canComplete", () => {
    it.each([
      ["is false for a Confirmed event just before the end", "Confirmed", JUST_BEFORE, false],
      ["is true for a Confirmed event exactly at the end", "Confirmed", ENDS_AT, true],
      ["is true for a Confirmed event just after the end", "Confirmed", JUST_AFTER, true],
      ["is false for a Planning event after the end", "Planning", JUST_AFTER, false],
      ["is false for a Completed event after the end", "Completed", JUST_AFTER, false],
    ] as const)("%s", (_label, status, now, expected) => {
      expect(canComplete(event({ status }), now)).toBe(expected);
    });

    it("is false for a Confirmed event with no slots", () => {
      expect(canComplete(event({ slots: [] }), JUST_AFTER)).toBe(false);
    });
  });
});
