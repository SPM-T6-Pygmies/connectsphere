import { z } from "zod";

/**
 * What the coordinator's withdrawal form submits (SPM-101).
 *
 * Shape only. Whether the request can still be withdrawn is the domain's call
 * (`withdrawEventRequest`), and the note is optional, so a blank one passes.
 */
export const withdrawEventRequestSchema = z.object({
  id: z.string().trim().min(1, "The event request is missing."),
  note: z.string(),
});

export type WithdrawEventRequestInput = z.infer<typeof withdrawEventRequestSchema>;
