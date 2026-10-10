import { z } from "zod";

/** What the coordinator's "Resubmit for safety check" button submits (SPM-261). */
export const resubmitForSafetyCheckSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
});

export type ResubmitForSafetyCheckInput = z.infer<typeof resubmitForSafetyCheckSchema>;
