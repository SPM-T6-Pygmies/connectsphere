import { describe, expect, it } from "vitest";

import { lineState } from "./equipment-line-state";

describe("lineState (SPM-41)", () => {
  it("is Requested while nothing is reserved", () => {
    expect(lineState(0, false)).toBe("Requested");
  });

  it("is Reserved once Technical Support have reserved against it", () => {
    expect(lineState(2, false)).toBe("Reserved");
  });

  it("is Under review when a reserved line was changed or its removal requested", () => {
    expect(lineState(2, true)).toBe("Under review");
  });
});
