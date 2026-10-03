import { z } from "zod";

/**
 * What Venue Staff's decision form submits (SPM-22).
 *
 * Shape only. Whether a rejection has its reason, whether the booking is still
 * waiting and whether an approval clashes are business rules, and they stay in
 * the domain (`decideBooking`) so every caller gets the same answer.
 */
const text = z.string().trim();

export const decideBookingRequestSchema = z.object({
  bookingId: text.min(1, "The booking is missing."),
  decision: z.enum(["approve", "reject"], { message: "Choose to approve or reject." }),
  note: text,
  alternative: text.transform((value) => (value === "" ? null : value)),
});

export type DecideBookingRequestInput = z.infer<typeof decideBookingRequestSchema>;
