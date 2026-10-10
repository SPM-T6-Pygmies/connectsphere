import { z } from "zod";

import { parseOptionList } from "@/core/domain/venue-options";

/**
 * What the coordinator's "Facilities needed" form submits (SPM-247).
 *
 * Shape only: the form posts the ticked facilities as one comma-separated
 * field (`OptionCheckboxes`), which becomes a list here. Whether each is a real
 * facility, and whether the event can still change, are business rules and
 * stay in the domain (`chooseRequiredFacilities`) so every caller gets the
 * same answer.
 */
export const setEventRequiredFacilitiesSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  eventRequestId: z.string().trim().min(1, "The event is missing."),
  facilities: z.string().transform((value) => parseOptionList(value)),
});

export type SetEventRequiredFacilitiesInput = z.infer<typeof setEventRequiredFacilitiesSchema>;
