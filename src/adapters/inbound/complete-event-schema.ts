import { z } from "zod";

/**
 * What the coordinator's "Mark completed" dialog submits (SPM-51).
 *
 * Shape only. Whether the event can be completed yet, and what blank notes
 * mean, are the domain's (`completeEvent`), so the notes are optional.
 */
export const completeEventSchema = z.object({
  id: z.string().trim().min(1, "The event is missing."),
  notes: z.string().optional(),
});

export type CompleteEventInput = z.infer<typeof completeEventSchema>;
