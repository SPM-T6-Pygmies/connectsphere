import { describe, expect, it } from "vitest";

import { setEventRequiredFacilitiesSchema } from "./set-event-required-facilities-schema";

const base = { eventId: "5", eventRequestId: "24" };

describe("setEventRequiredFacilitiesSchema (SPM-247)", () => {
  it("turns the posted comma-separated field into a list", () => {
    const parsed = setEventRequiredFacilitiesSchema.parse({ ...base, facilities: "Wi-Fi, Catering area" });
    expect(parsed.facilities).toEqual(["Wi-Fi", "Catering area"]);
  });

  it("reads an empty field as nothing needed", () => {
    expect(setEventRequiredFacilitiesSchema.parse({ ...base, facilities: "" }).facilities).toEqual([]);
  });

  it("leaves a value that is not a facility for the domain to refuse", () => {
    const parsed = setEventRequiredFacilitiesSchema.parse({ ...base, facilities: "Projector" });
    expect(parsed.facilities).toEqual(["Projector"]);
  });

  it("refuses a missing event", () => {
    expect(setEventRequiredFacilitiesSchema.safeParse({ ...base, eventId: " ", facilities: "" }).success).toBe(false);
    expect(setEventRequiredFacilitiesSchema.safeParse({ ...base, eventRequestId: "", facilities: "" }).success).toBe(false);
  });
});
