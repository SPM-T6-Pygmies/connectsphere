"use server";

import { revalidatePath } from "next/cache";

import { changeBookingRoomLayoutSchema } from "@/adapters/inbound/change-booking-room-layout-schema";
import { setEventRequiredFacilitiesSchema } from "@/adapters/inbound/set-event-required-facilities-schema";
import { submitVenueBookingRequestSchema } from "@/adapters/inbound/submit-venue-booking-request-schema";
import {
  buildChangeBookingRoomLayout,
  buildSetEventRequiredFacilities,
  buildSubmitVenueBookingRequest,
  getCurrentCoordinator,
} from "@/composition/container";
import { CoordinatorEventNotFoundError, DomainError } from "@/core/domain/errors";

import { describeCapacity } from "../../../booking-capacity-message";

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

export type ChangeBookingRoomLayoutState =
  | { status: "idle" }
  | { status: "changed"; bookingId: string; summary: string }
  | { status: "error"; message: string };

/**
 * SPM-104: the assigned Event Coordinator moves a pending booking request to
 * another layout of the same venue.
 *
 * As with the submit action, who is asking comes from `getCurrentCoordinator()`
 * on the server, never from the form, and a broken business rule comes back as
 * a message.
 */
export async function changeBookingRoomLayoutAction(
  _previous: ChangeBookingRoomLayoutState,
  formData: FormData,
): Promise<ChangeBookingRoomLayoutState> {
  const parsed = changeBookingRoomLayoutSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
    bookingId: String(formData.get("bookingId") ?? ""),
    roomLayout: String(formData.get("roomLayout") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the layout." };
  }

  const { eventRequestId, ...command } = parsed.data;

  let changed: { bookingId: string; summary: string };
  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }

    const changeBookingRoomLayout = await buildChangeBookingRoomLayout();
    const result = await changeBookingRoomLayout.execute({ ...command, ...coordinator });
    changed = { bookingId: result.bookingId, summary: describeCapacity(result.capacity).text };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath(`/staff/coordinator/${eventRequestId}/venue-booking`);

  return { status: "changed", ...changed };
}

export type SetEventRequiredFacilitiesState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

/**
 * SPM-247: the assigned Event Coordinator records the facilities the event
 * needs. As with the other actions here, who is asking comes from
 * `getCurrentCoordinator()` on the server, never from the form, and a broken
 * business rule comes back as a message.
 */
export async function setEventRequiredFacilitiesAction(
  _previous: SetEventRequiredFacilitiesState,
  formData: FormData,
): Promise<SetEventRequiredFacilitiesState> {
  const parsed = setEventRequiredFacilitiesSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
    facilities: String(formData.get("facilities") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the facilities." };
  }

  const { eventRequestId, ...command } = parsed.data;

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }

    const setEventRequiredFacilities = await buildSetEventRequiredFacilities();
    await setEventRequiredFacilities.execute({ ...command, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath(`/staff/coordinator/${eventRequestId}/venue-booking`);

  return { status: "saved" };
}
