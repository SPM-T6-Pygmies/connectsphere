import { z } from "zod";

import { BOOKING_SLOTS } from "@/core/domain/booking";

/**
 * What the coordinator's booking request form submits (SPM-46).
 *
 * Shape only: each slot arrives as `YYYY-MM-DD|AM`. Whether the date is a
 * real day, whether a slot repeats, whether the venue needs a layout and
 * whether a slot is already taken are business rules, and they stay in the
 * domain (`requestVenueBooking`) so every caller gets the same answer.
 */
export const submitVenueBookingRequestSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  eventRequestId: z.string().trim().min(1, "The event is missing."),
  venueId: z.string().trim().min(1, "Choose a venue."),
  roomLayout: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  slots: z.array(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}\|(AM|PM|Night)$/, "A slot is not in a form the server can read.")
      .transform((value) => {
        const [date, slot] = value.split("|");
        return { date, slot: BOOKING_SLOTS.find((candidate) => candidate === slot)! };
      }),
  ),
});

export type SubmitVenueBookingRequestInput = z.infer<typeof submitVenueBookingRequestSchema>;
