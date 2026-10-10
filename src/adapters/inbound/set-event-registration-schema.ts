import { z } from "zod";

/**
 * What the coordinator's registration settings form submits (SPM-25).
 *
 * Shape only: a ticked toggle posts `on` and an unticked one posts nothing,
 * and the dates arrive as `<input type="date">` text, blank when unset.
 * Whether the dates are real days, whether enabling has both and whether the
 * window runs the right way are business rules, and they stay in the domain
 * (`chooseRegistrationSettings`) so every caller gets the same answer.
 */
const date = z.string().transform((value) => (value.trim() === "" ? null : value));

export const setEventRegistrationSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  enabled: z
    .enum(["", "on", "true", "false"], { message: "Registration must be on or off." })
    .transform((value) => value === "on" || value === "true"),
  opensOn: date,
  closesOn: date,
});

export type SetEventRegistrationInput = z.infer<typeof setEventRegistrationSchema>;
