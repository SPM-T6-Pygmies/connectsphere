"use server";

import { z } from "zod";

import { submitVenueBookingRequestSchema } from "@/adapters/inbound/submit-venue-booking-request-schema";
import { buildSubmitVenueBookingRequest, getCurrentCoordinator } from "@/composition/container";
import { DomainError, NoBookingSlotsSelectedError } from "@/core/domain/errors";
import type { SubmitVenueBookingRequestResult } from "@/core/use-cases/submit-venue-booking-request";

export type SubmitVenueBookingRequestState =
  | { status: "idle" }
  | { status: "submitted"; result: SubmitVenueBookingRequestResult }
  | {
      status: "error";
      message: string;
      fieldErrors?: { readonly venueId?: string[]; readonly roomLayoutId?: string[]; readonly slots?: string[] };
    };

/**
 * SPM-46: the assigned Event Coordinator submits a venue booking request.
 *
 * Four responsibilities, all translation: read the `FormData`, check its
 * shape, call the use case, turn the outcome into something renderable --
 * the same split `submitEventRequestAction` draws. Which fields are
 * mandatory, whether the layout is supported, and whether the slot is
 * already taken are not decided here; the domain decides and this only puts
 * each refusal against the right input.
 */
export async function submitVenueBookingRequestAction(
  _previous: SubmitVenueBookingRequestState,
  formData: FormData,
): Promise<SubmitVenueBookingRequestState> {
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    throw new Error("Only a signed-in Event Coordinator can submit a venue booking request.");
  }

  const input: z.input<typeof submitVenueBookingRequestSchema> = {
    eventId: String(formData.get("eventId") ?? ""),
    coordinatorUserAccountId: coordinator.userAccountId,
    venueId: String(formData.get("venueId") ?? ""),
    roomLayoutId: String(formData.get("roomLayoutId") ?? ""),
    slots: String(formData.get("slotsJson") ?? ""),
  };

  const parsed = submitVenueBookingRequestSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { venueId: fieldErrors.venueId, roomLayoutId: fieldErrors.roomLayoutId, slots: fieldErrors.slots },
    };
  }

  try {
    const submitVenueBookingRequest = await buildSubmitVenueBookingRequest();
    const result = await submitVenueBookingRequest.execute(parsed.data);

    return { status: "submitted", result };
  } catch (error) {
    // An empty slot list is an expected outcome and becomes a message against
    // that input. Any other domain refusal (unsupported layout, an already
    // confirmed slot, an event that isn't the caller's) becomes a banner
    // message. Anything else is a genuine fault and reaches the error
    // boundary rather than being dressed up as a validation failure.
    if (error instanceof NoBookingSlotsSelectedError) {
      return { status: "error", message: error.message, fieldErrors: { slots: [error.message] } };
    }

    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }

    throw error;
  }
}
