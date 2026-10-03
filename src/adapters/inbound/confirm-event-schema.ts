import { z } from "zod";

/** What the coordinator's "Confirm event" button submits (SPM-50). */
export const confirmEventSchema = z.object({
  id: z.string().trim().min(1, "The event is missing."),
});

export type ConfirmEventInput = z.infer<typeof confirmEventSchema>;
