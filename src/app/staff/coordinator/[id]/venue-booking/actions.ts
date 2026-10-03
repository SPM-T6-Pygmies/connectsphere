"use server";

import { revalidatePath } from "next/cache";

import { submitVenueBookingRequestSchema } from "@/adapters/inbound/submit-venue-booking-request-schema";
import { buildSubmitVenueBookingRequest, getCurrentCoordinator } from "@/composition/container";
import { CoordinatorEventNotFoundError, DomainError } from "@/core/domain/errors";

export type SubmitVenueBookingRequestState =
  | { status: "idle" }
  | { status: "submitted"; bookingId: string; venueLocation: string }
  | { status: "error"; message: string };

/**
 * SPM-46: the assigned Event Coordinator sends a venue booking request.
 *
 * Who is asking comes from `getCurrentCoordinator()` on the server, never from
 * the form. A broken business rule -- a clash, a missing layout -- comes back
 * as a message; anything else is a genuine fault for the error boundary.
 */
export async function submitVenueBookingRequestAction(
  _previous: SubmitVenueBookingRequestState,
  formData: FormData,
): Promise<SubmitVenueBookingRequestState> {
  const parsed = submitVenueBookingRequestSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
    venueId: String(formData.get("venueId") ?? ""),
    roomLayout: String(formData.get("roomLayout") ?? ""),
    slots: formData.getAll("slot").map(String),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the request." };
  }

  const { eventRequestId, ...command } = parsed.data;

  let submitted: { bookingId: string; venueLocation: string };
  try {
    // Not a coordinator gets the same answer as not this event's (#91).
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }

    const submitVenueBookingRequest = await buildSubmitVenueBookingRequest();
    submitted = await submitVenueBookingRequest.execute({ ...command, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath(`/staff/coordinator/${eventRequestId}/venue-booking`);

  return {
    status: "submitted",
    bookingId: submitted.bookingId,
    venueLocation: submitted.venueLocation,
  };
}
