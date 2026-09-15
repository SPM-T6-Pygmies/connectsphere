import { z } from "zod";

/**
 * The sign-in form's shape: an email and a password, both present.
 *
 * Presence only -- no trimming and no email-format check, the same as the
 * action checked by hand. Every refusal reads "Invalid credentials" whatever
 * the cause, so a malformed address is reported exactly like a wrong one and
 * the form never hints at which accounts exist.
 */
export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
