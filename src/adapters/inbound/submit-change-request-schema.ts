import { z } from "zod";

const timeRange = z.object({ date: z.string(), start: z.string(), end: z.string() });
const registration = z.object({
  enabled: z.boolean(),
  opensOn: z.string().nullable(),
  closesOn: z.string().nullable(),
});

/** One requested field. `null` is Not applicable, for the two fields that allow it. */
const change = z.discriminatedUnion("field", [
  z.object({ field: z.literal("times"), value: z.array(timeRange) }),
  z.object({ field: z.literal("venue_requirements"), value: z.string() }),
  // A blank box posts null; reading it as NaN leaves "not a whole number" to the core.
  z.object({
    field: z.literal("expected_attendance"),
    value: z
      .number()
      .nullable()
      .transform((value) => value ?? Number.NaN),
  }),
  z.object({ field: z.literal("equipment_requirements"), value: z.string().nullable() }),
  z.object({ field: z.literal("registration"), value: registration.nullable() }),
]);

/**
 * What the change request form submits (SPM-52): the request id, and the
 * ticked fields as one JSON `changes` value, since a field's value can be a
 * list of times or a registration window.
 *
 * Shape only. Whether the times are on the grid, the attendance a whole
 * number, or the list non-empty are the core's rules (`chooseRequestedChanges`).
 */
export const submitChangeRequestSchema = z.object({
  eventRequestId: z.string().trim().min(1, "The event request is missing."),
  changes: z.string().transform((raw, context) => {
    try {
      return z.array(change).parse(JSON.parse(raw));
    } catch {
      context.addIssue({ code: "custom", message: "The changes could not be read." });
      return z.NEVER;
    }
  }),
});

export type SubmitChangeRequestInput = z.infer<typeof submitChangeRequestSchema>;
