import { describe, expect, it } from "vitest";

import { registrationConfirmed } from "./registration-confirmed";

describe("registrationConfirmed (SPM-305)", () => {
  it("cannot be switched off, since its link is the attendee's only way back", async () => {
    const definition = await registrationConfirmed.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });

  it("sends an email and nothing else, since an attendee has no Inbox", async () => {
    const definition = await registrationConfirmed.discover();

    expect(definition.steps.map((step) => step.type)).toEqual(["email"]);
  });
});
