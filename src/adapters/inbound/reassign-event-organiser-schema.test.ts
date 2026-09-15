import { describe, expect, it } from "vitest";

import { reassignEventOrganiserSchema } from "./reassign-event-organiser-schema";

describe("reassignEventOrganiserSchema", () => {
  it("accepts a request and the Organiser chosen for it", () => {
    const parsed = reassignEventOrganiserSchema.safeParse({
      eventRequestId: "19",
      newResponsibleOrganiserId: "6",
    });

    expect(parsed.success).toBe(true);
  });

  it("trims the chosen Organiser's id", () => {
    const parsed = reassignEventOrganiserSchema.safeParse({
      eventRequestId: "19",
      newResponsibleOrganiserId: " 6 ",
    });

    expect(parsed.success && parsed.data.newResponsibleOrganiserId).toBe("6");
  });

  it("rejects a reassignment with no Organiser chosen", () => {
    const parsed = reassignEventOrganiserSchema.safeParse({
      eventRequestId: "19",
      newResponsibleOrganiserId: "   ",
    });

    expect(parsed.success).toBe(false);
  });
});
