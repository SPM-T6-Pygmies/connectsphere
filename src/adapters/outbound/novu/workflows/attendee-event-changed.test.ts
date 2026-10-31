import { describe, expect, it } from "vitest";

import { eventCancelledForAttendee } from "./attendee-event-cancelled";
import { eventRescheduledForAttendee } from "./attendee-event-rescheduled";

describe("attendee event change workflows (SPM-69)", () => {
  it.each([
    ["rescheduled", eventRescheduledForAttendee],
    ["cancelled", eventCancelledForAttendee],
  ])("the %s email is an email and nothing else, since an attendee has no Inbox", async (_kind, definitionOf) => {
    const definition = await definitionOf.discover();

    expect(definition.steps.map((step) => step.type)).toEqual(["email"]);
    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });
});
