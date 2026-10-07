import { describe, expect, it } from "vitest";

import { NotCoordinatorLeadError } from "@/core/domain/errors";

import { toLeadEventError } from "./lead-event-mapper";

describe("toLeadEventError (SPM-256)", () => {
  it("maps SQLSTATE CS060 to the not-a-Lead error", () => {
    expect(toLeadEventError({ code: "CS060" })).toBeInstanceOf(NotCoordinatorLeadError);
  });

  it("leaves any other failure to the caller", () => {
    expect(toLeadEventError({ code: "CS050" })).toBeNull();
    expect(toLeadEventError({})).toBeNull();
  });
});
