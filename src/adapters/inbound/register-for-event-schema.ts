import { z } from "zod";

/**
 * The registration form's shape.
 *
 * Shape only -- whether the event is open, has room, or has already seen this
 * email are rules, and rules live in the core. Full name and email are the
 * whole field set (SPM-83); nothing here is configurable per event.
 *
 * `eventId` is checked for presence and nothing more. What an id *looks like*
 * is the store's business, not the transport's: this boundary asserting uuid
 * is what rejected every real event once the catalogue started issuing the
 * team schema's numeric keys. An id that is well formed but not ours is a
 * miss, and the catalogue already reports it as one.
 */
export const registerForEventSchema = z.object({
  eventId: z.string().trim().min(1, "That event link is not valid."),
  fullName: z.string().trim().min(1, "Enter your full name."),
  email: z.email("Enter a valid email address."),
});

export type RegisterForEventInput = z.infer<typeof registerForEventSchema>;
