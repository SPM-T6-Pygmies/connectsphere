import { describe, expect, it } from "vitest";

import type { EventNoLongerConfirmedNotice } from "@/core/ports/outbound/notifier";

import { eventNoLongerConfirmedMessage } from "./event-no-longer-confirmed";

function notice(overrides: Partial<EventNoLongerConfirmedNotice> = {}): EventNoLongerConfirmedNotice {
  return {
    recipientUserAccountId: "6",
    eventId: "7",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    lapsed: [{ kind: "flagged-booking", venueLocation: "Main Hall" }],
    ...overrides,
  };
}

describe("eventNoLongerConfirmedMessage (SPM-111)", () => {
  it("AC2: names the one arrangement that lapsed and that the event is back in Planning", () => {
    expect(eventNoLongerConfirmedMessage(notice())).toEqual({
      subject: "Marina Bay Gala is no longer confirmed",
      body: "Marina Bay Gala is back in Planning: its booking of Main Hall is being re-checked. Your coordinator will confirm it again once this is sorted out; until then, do not rely on these arrangements.",
    });
  });

  it("AC2: names every arrangement when two lapsed", () => {
    const { body } = eventNoLongerConfirmedMessage(
      notice({
        lapsed: [
          { kind: "arrangement", type: "venue" },
          { kind: "equipment", equipmentType: "Projector" },
        ],
      }),
    );

    expect(body).toContain(
      "is back in Planning: its venue booking is no longer confirmed and the Projector is no longer reserved in full.",
    );
  });

  it("AC2: describes the programme, registration and safety check in plain words", () => {
    const { body } = eventNoLongerConfirmedMessage(
      notice({
        lapsed: [
          { kind: "arrangement", type: "programme" },
          { kind: "arrangement", type: "registration" },
          { kind: "safety-check" },
        ],
      }),
    );

    expect(body).toContain(
      "its programme is missing, its registration is not set up and its safety check is no longer approved.",
    );
  });
});
