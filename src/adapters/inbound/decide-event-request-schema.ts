import { z } from "zod";

/**
 * What the coordinator's decision form submits (SPM-34).
 *
 * Shape only. Whether a rejection has its reason is a business rule, and it
 * stays in the domain (`rejectEventRequest`) so the form and every other
 * caller get the same answer.
 */
export const decideEventRequestSchema = z.object({
  id: z.string().trim().min(1, "The event request is missing."),
  decision: z.enum(["approve", "reject"]),
  decisionRecord: z.string(),
});

export type DecideEventRequestInput = z.infer<typeof decideEventRequestSchema>;
