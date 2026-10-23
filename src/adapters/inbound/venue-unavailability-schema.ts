import { z } from "zod";

/**
 * What the "Mark unavailable" form submits (SPM-21).
 *
 * Shape only: dates are `YYYY-MM-DD` text and the times are `HH:MM` text.
 * Whether a date is a real day, whether a time is on the 15-minute grid, whether the
 * venue is open then, whether the range runs the right way, whether it has already ended, whether the reason is one of
 * the five and whether a note belongs under it are business rules, and they
 * stay in the domain (`defineVenueUnavailability`) so every caller gets the
 * same answer.
 */
const date = (message: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, message);

export const recordVenueUnavailabilitySchema = z.object({
  venueId: z.string().trim().min(1, "Choose a venue."),
  startDate: date("Enter the start date."),
  endDate: date("Enter the end date."),
  startTime: z.string().trim(),
  endTime: z.string().trim(),
  reason: z.string().trim(),
  note: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
});

export type RecordVenueUnavailabilityInput = z.infer<typeof recordVenueUnavailabilitySchema>;

export const liftVenueUnavailabilitySchema = z.object({
  unavailabilityId: z.string().trim().min(1, "The block is missing."),
});
