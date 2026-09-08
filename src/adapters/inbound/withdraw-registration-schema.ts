import { z } from "zod";

/**
 * The withdrawal form's shape, which is one hidden field.
 *
 * Presence and nothing more. Not `z.uuid()`, for the reason spelled out on
 * `registerForEventSchema`: what an id *looks like* is the store's business,
 * not the transport's, and the in-memory adapter this app falls back to issues
 * `registration-1`. A reference that is well formed but not ours is a miss, and
 * the repository already reports it as one.
 */
export const withdrawRegistrationSchema = z.object({
  reference: z.string().trim().min(1, "That registration link is not valid."),
});

export type WithdrawRegistrationInput = z.infer<typeof withdrawRegistrationSchema>;
