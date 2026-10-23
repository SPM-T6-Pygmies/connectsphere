import type { Novu } from "@novu/api";
import { describe, expect, it, vi } from "vitest";

import { NovuNotifier, triggerFailure } from "./novu-notifier";

describe("triggerFailure (SPM-173)", () => {
  it("accepts a trigger Novu acknowledged and processed", () => {
    expect(triggerFailure({ acknowledged: true, status: "processed" })).toBeNull();
  });

  it("reports a trigger Novu answered without processing, with its reasons", () => {
    expect(
      triggerFailure({
        acknowledged: true,
        status: "no_workflow_active_steps_defined",
        error: ["workflow has no active steps"],
      }),
    ).toBe("no_workflow_active_steps_defined: workflow has no active steps");
  });

  it("reports a trigger Novu did not acknowledge", () => {
    expect(triggerFailure({ acknowledged: false, status: "error" })).toBe("error");
  });
});

describe("NovuNotifier (SPM-178)", () => {
  const notice = {
    recipientUserAccountId: "2",
    eventRequestId: "10",
    eventName: "Quarterly Partner Forum",
    clientOrganisationName: null,
    preferredDate: null,
    preferredSlots: [],
  };

  function novuThatAccepts() {
    const trigger = vi.fn().mockResolvedValue({ result: { acknowledged: true, status: "processed" } });
    return { novu: { trigger } as unknown as Novu, trigger };
  }

  it("sends to the recipient's own subscriber on a deployment", async () => {
    const { novu, trigger } = novuThatAccepts();

    await new NovuNotifier(novu).eventCoordinatorAssigned(notice);

    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({ to: "2" }));
  });

  it("sends to the developer's own prefixed subscriber locally", async () => {
    const { novu, trigger } = novuThatAccepts();

    await new NovuNotifier(novu, "https://tunnel.novu.sh/api/novu", "sam-").eventCoordinatorAssigned(
      notice,
    );

    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({ to: "sam-2" }));
  });
});

describe("NovuNotifier registration email (SPM-305)", () => {
  const notice = {
    registrationId: "r1",
    recipientEmail: "ada@example.com",
    attendeeName: "Ada Lovelace",
    eventName: "Pygmies Product Summit",
    startsAt: "2026-09-30T23:00:00.000Z",
    times: [{ date: "2026-10-01", start: "07:00", end: "12:00" }],
    venueName: null,
  };

  function novuThatAccepts() {
    const trigger = vi.fn().mockResolvedValue({ result: { acknowledged: true, status: "processed" } });
    return { novu: { trigger } as unknown as Novu, trigger };
  }

  it("AC1: emails the attendee an absolute link to their registration", async () => {
    const { novu, trigger } = novuThatAccepts();

    await new NovuNotifier(novu, undefined, "", "https://connectsphere.example").registrationConfirmed(
      notice,
    );

    expect(trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "registration-confirmed",
        to: { subscriberId: "registration-r1", email: "ada@example.com", firstName: "Ada Lovelace" },
        payload: { ...notice, registrationUrl: "https://connectsphere.example/registrations/r1" },
      }),
    );
  });

  it("keeps a developer's attendee subscribers apart locally", async () => {
    const { novu, trigger } = novuThatAccepts();

    await new NovuNotifier(novu, "https://tunnel.novu.sh/api/novu", "sam-").registrationConfirmed(notice);

    expect(trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ subscriberId: "sam-registration-r1" }),
        payload: expect.objectContaining({ registrationUrl: "http://localhost:3000/registrations/r1" }),
      }),
    );
  });

  it("throws when Novu does not process it, for the recording decorator to log", async () => {
    const trigger = vi.fn().mockResolvedValue({ result: { acknowledged: true, status: "error" } });

    await expect(
      new NovuNotifier({ trigger } as unknown as Novu).registrationConfirmed(notice),
    ).rejects.toThrow(/registration-confirmed/);
  });
});
