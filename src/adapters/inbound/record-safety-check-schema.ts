import { z } from "zod";

/**
 * What the Safety Officer's outcome form submits (SPM-260).
 *
 * Shape only. Whether a rejection says enough and whether the event can still
 * take an outcome are business rules, and they stay in the domain
 * (`recordSafetyCheck`) so every caller gets the same answer.
 */
export const recordSafetyCheckSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  outcome: z.enum(["Approved", "Rejected"], { message: "Choose to approve or reject." }),
  comments: z.string(),
});

export type RecordSafetyCheckInput = z.infer<typeof recordSafetyCheckSchema>;
