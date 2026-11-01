import { describe, expect, it } from "vitest";

import { WORKFLOWS } from "./novu-bridge";

// Novu's Free and Pro plans allow 20 workflows. Above that the sync after a
// deploy fails, so every workflow not yet synced answers `workflow_not_found`
// when triggered, while the ones synced earlier keep working.
const NOVU_PLAN_WORKFLOW_LIMIT = 20;

describe("the Novu bridge (SPM-69)", () => {
  it("serves no more workflows than the Novu plan can sync", () => {
    expect(WORKFLOWS.length).toBeLessThanOrEqual(NOVU_PLAN_WORKFLOW_LIMIT);
  });
});
