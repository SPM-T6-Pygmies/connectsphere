import { z } from "zod";

/**
 * What the coordinator's booking request form submits (SPM-46, SPM-324).
 *
 * Shape only: each requested date arrives with its start and end time as
 * `HH:MM`, and a field left blank stays blank. Whether a date or time is
 * missing, whether it is a real day on the 15-minute grid, whether a date
 * repeats, whether the venue needs a layout and whether the time is already
 * taken are business rules, and they stay in the domain
 * (`requestVenueBooking`) so every caller gets the same answer -- naming what
 * is missing.
 */
export const submitVenueBookingRequestSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  eventRequestId: z.string().trim().min(1, "The event is missing."),
  venueId: z.string().trim().min(1, "Choose a venue."),
  roomLayout: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  times: z.array(z.object({ date: z.string(), start: z.string(), end: z.string() })),
});

export type SubmitVenueBookingRequestInput = z.infer<typeof submitVenueBookingRequestSchema>;
