import { z } from "zod";

/**
 * What the coordinator's change-layout form submits (SPM-104).
 *
 * Shape only: whether the layout is one the venue supports, and whether the
 * request can still change, are business rules and stay in the domain
 * (`chooseLayoutChange`) so every caller gets the same answer.
 */
export const changeBookingRoomLayoutSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  eventRequestId: z.string().trim().min(1, "The event is missing."),
  bookingId: z.string().trim().min(1, "The booking is missing."),
  roomLayout: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
});

export type ChangeBookingRoomLayoutInput = z.infer<
  typeof changeBookingRoomLayoutSchema
>;
