import { z } from "zod";

/**
 * What Venue Staff's decision form submits (SPM-22).
 *
 * Shape only. Whether a rejection has its reason, whether the booking is still
 * waiting, whether an approval or a hold clashes and whether a hold is still live to confirm
 * or release (SPM-219) are business rules, and they stay in
 * the domain (`decideBooking`) so every caller gets the same answer.
 */
const text = z.string().trim();

export const decideBookingRequestSchema = z.object({
  bookingId: text.min(1, "The booking is missing."),
  decision: z.enum(["approve", "hold", "reject", "confirm", "release"], {
    message: "Choose to approve, hold, reject, confirm or release.",
  }),
  note: text,
  alternative: text.transform((value) => (value === "" ? null : value)),
});

export type DecideBookingRequestInput = z.infer<typeof decideBookingRequestSchema>;
