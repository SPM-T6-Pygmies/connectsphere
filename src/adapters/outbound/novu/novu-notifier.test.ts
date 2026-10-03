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
    preferredStartTime: null,
    preferredEndTime: null,
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
