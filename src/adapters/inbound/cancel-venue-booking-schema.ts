import { z } from "zod";

/**
 * What the coordinator's cancel-booking form submits (SPM-20).
 *
 * Shape only: whether the booking can still be cancelled is a business rule
 * and stays in the domain (`cancelBooking`) so every caller gets the same
 * answer.
 */
export const cancelVenueBookingSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  eventRequestId: z.string().trim().min(1, "The event is missing."),
  bookingId: z.string().trim().min(1, "The booking is missing."),
});

export type CancelVenueBookingInput = z.infer<typeof cancelVenueBookingSchema>;
