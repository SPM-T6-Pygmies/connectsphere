import { z } from "zod";

/**
 * What the coordinator's "Cancel event" dialog submits (SPM-55).
 *
 * Shape only. Whether the event can still be cancelled is the domain's
 * (`cancelEvent`).
 */
export const cancelEventSchema = z.object({
  id: z.string().trim().min(1, "The event is missing."),
});

export type CancelEventInput = z.infer<typeof cancelEventSchema>;
