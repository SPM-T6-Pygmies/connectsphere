import { z } from "zod";

/**
 * What the booking form submits (SPM-46). Shape only -- whether at least one
 * slot was chosen and whether the layout is one the venue supports are
 * business rules, decided in the domain (`submitVenueBookingRequest`,
 * `resolveRequestedLayout`) so this boundary does not have a second,
 * driftable copy of either.
 */
const slotSelection = z.object({
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date as YYYY-MM-DD."),
  slot: z.enum(["AM", "PM", "Night"]),
});

/**
 * No existing form in this repo posts a variable-length list of structured
 * values, so the client form serialises the coordinator's day/slot picks
 * into one hidden JSON field (`slotsJson`) and this parses it back.
 */
const slotsFromJson = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) {
      return [];
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Could not read the selected slots." });
      return z.NEVER;
    }
  })
  .pipe(z.array(slotSelection));

/** Blank when the venue supports at most one layout -- see `resolveRequestedLayout`. */
const optionalRoomLayoutId = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

export const submitVenueBookingRequestSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  coordinatorUserAccountId: z.string().trim().min(1),
  venueId: z.string().trim().min(1, "Choose a venue."),
  roomLayoutId: optionalRoomLayoutId,
  slots: slotsFromJson,
});

export type SubmitVenueBookingRequestInput = z.infer<typeof submitVenueBookingRequestSchema>;
