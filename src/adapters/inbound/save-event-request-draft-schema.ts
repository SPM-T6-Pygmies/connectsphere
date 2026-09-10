import { z } from "zod";

/**
 * The "save a draft" form's shape (SPM-38/SPM-94) -- and only its shape.
 *
 * Same reasoning as `submitEventRequestSchema`: this boundary answers "is
 * this input the right kind of thing?", not "is it complete enough". A draft
 * never has to be complete at all -- `saveEventRequestDraft` is where that
 * rule (just a name) actually lives -- so every field here is optional,
 * including the ones `submitEventRequestSchema` also has to check.
 *
 * No `organiserTimeZone`: a draft is never checked against "today", so there
 * is nothing here that needs to know the Organiser's zone.
 */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

const optionalAttendance = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : Number(value)))
  .refine((value) => value === null || Number.isInteger(value), {
    message: "Enter a whole number of attendees.",
  })
  .refine((value) => value === null || value >= 0, {
    message: "Expected attendance cannot be negative.",
  });

const optionalDate = optionalText.refine(
  (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
  { message: "Enter the date as YYYY-MM-DD." },
);

const optionalDateTime = optionalText.refine(
  (value) =>
    value === null ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.test(value),
  { message: "Enter a valid date and time." },
);

/** Blank for a new draft, an id when updating a saved one in place. */
const optionalEventRequestId = optionalText;

export const saveEventRequestDraftSchema = z.object({
  eventRequestId: optionalEventRequestId,
  responsibleOrganiserId: z.string().trim().min(1),
  clientOrganisationId: z.string().trim().min(1),
  eventName: optionalText.transform((value) => value ?? ""),
  description: optionalText,
  purpose: optionalText,
  preferredDate: optionalDate,
  preferredStartTime: optionalDateTime,
  preferredEndTime: optionalDateTime,
  expectedAttendance: optionalAttendance,
  venueRequirements: optionalText,
  roomLayoutPreferences: optionalText,
  accessibilityNeeds: optionalText,
  equipmentRequirements: optionalText,
  registrationRequirements: optionalText,
  generalProgramme: optionalText,
  otherSpecialArrangements: optionalText,
});

export type SaveEventRequestDraftInput = z.infer<typeof saveEventRequestDraftSchema>;
