import { z } from "zod";

/**
 * What the coordinator's Clear flag form submits (SPM-310).
 *
 * Shape only: whether the booking has a flag to clear is a business rule and
 * stays in the domain (`flagsToClear`).
 */
export const clearBookingFlagSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  eventRequestId: z.string().trim().min(1, "The event is missing."),
  bookingId: z.string().trim().min(1, "The booking is missing."),
});

export type ClearBookingFlagInput = z.infer<typeof clearBookingFlagSchema>;
