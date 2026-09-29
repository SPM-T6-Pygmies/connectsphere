import { z } from "zod";

/**
 * What the clarification thread's reply box submits (SPM-33).
 *
 * Shape only. Whether the body says anything, and whether the parent is a
 * top-level message, are business rules that stay in the core -- the same
 * split `decideEventRequestSchema` draws over a rejection's reason.
 *
 * `parentId` is absent from the FormData when the box is starting a new
 * top-level message rather than replying, so an empty string means "no
 * parent" rather than "a parent whose id is blank".
 */
export const postClarificationMessageSchema = z.object({
  id: z.string().trim().min(1, "The event request is missing."),
  body: z.string(),
  parentId: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null),
});

export type PostClarificationMessageInput = z.infer<typeof postClarificationMessageSchema>;
