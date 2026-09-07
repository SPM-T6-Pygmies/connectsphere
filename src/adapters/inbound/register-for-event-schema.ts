import { z } from "zod";

/**
 * The registration form's shape.
 *
 * Shape only -- whether the event is open, has room, or has already seen this
 * email are rules, and rules live in the core. Full name and email are the
 * whole field set (SPM-83); nothing here is configurable per event.
 */
export const registerForEventSchema = z.object({
  eventId: z.uuid("That event link is not valid."),
  fullName: z.string().trim().min(1, "Enter your full name."),
  email: z.email("Enter a valid email address."),
});

export type RegisterForEventInput = z.infer<typeof registerForEventSchema>;
