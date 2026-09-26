import { describe, expect, it } from "vitest";

import { triggerFailure } from "./novu-notifier";

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
