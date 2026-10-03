import { z } from "zod";

/**
 * What the coordinator's booking request form submits (SPM-46).
 *
 * Shape only: each time arrives as `YYYY-MM-DD|HH:MM|HH:MM` (date, start,
 * end). Whether the date is a real day, whether the times are on the quarter
 * hour and inside the venue's hours, whether two overlap, whether the venue
 * needs a layout and whether a time is already taken are business rules, and they stay in the
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
      .regex(
        /^\d{4}-\d{2}-\d{2}\|\d{1,2}:\d{2}\|\d{1,2}:\d{2}$/,
        "A time is not in a form the server can read.",
      )
      .transform((value) => {
        const [date, start, end] = value.split("|");
        return { date, start, end };
      }),
  ),
});

export type SubmitVenueBookingRequestInput = z.infer<
  typeof submitVenueBookingRequestSchema
>;
