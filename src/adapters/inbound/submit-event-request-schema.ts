import { z } from "zod";

/**
 * The event request form's shape -- and only its shape.
 *
 * This boundary answers "is this input the right kind of thing?" and nothing
 * else. Whether enough of it was filled in to submit is a rule, and rules live
 * in the core (`missingMandatoryFields`). Asserting mandatory-ness here as well
 * would give the question two homes that drift apart, and the customer has not
 * settled which fields those are (#72) -- exactly the answer you do not want
 * written down twice.
 *
 * So every text field is optional here, including the mandatory ones. A blank
 * box becomes `null` rather than `""`, so "absent" has one representation by
 * the time the core sees it, and the store gets a null instead of an empty
 * string in a nullable column.
 */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

/**
 * `<input type="number">` posts a string, and an empty box posts `""`.
 *
 * Coercion belongs here rather than in the core, which takes a number or a
 * null and holds no opinion about how a browser spells one. A negative
 * attendance is refused at this boundary because `expected_attendance >= 0` is
 * the column's own check -- the form should not be able to post a row the
 * store would reject.
 */
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

/** What `<input type="date">` posts, and what `date` columns accept. */
const optionalDate = optionalText.refine(
  (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
  { message: "Enter the date as YYYY-MM-DD." },
);

export const submitEventRequestSchema = z.object({
  responsibleOrganiserId: z.string().trim().min(1),
  clientOrganisationId: z.string().trim().min(1),
  eventName: optionalText.transform((value) => value ?? ""),
  description: optionalText,
  purpose: optionalText,
  preferredDate: optionalDate,
  preferredTime: optionalText,
  expectedAttendance: optionalAttendance,
  venueRequirements: optionalText,
  roomLayoutPreferences: optionalText,
  accessibilityNeeds: optionalText,
  equipmentRequirements: optionalText,
  registrationRequirements: optionalText,
  generalProgramme: optionalText,
  otherSpecialArrangements: optionalText,
});

export type SubmitEventRequestInput = z.infer<typeof submitEventRequestSchema>;
