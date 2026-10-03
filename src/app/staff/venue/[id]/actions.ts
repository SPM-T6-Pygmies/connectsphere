"use server";

import { revalidatePath } from "next/cache";

import { decideBookingRequestSchema } from "@/adapters/inbound/decide-booking-request-schema";
import { buildDecideBookingRequest, getCurrentVenueStaff } from "@/composition/container";
import { BookingNotFoundError, DomainError } from "@/core/domain/errors";

export type DecideBookingRequestState =
  | { status: "idle" }
  | { status: "error"; message: string; note: string; alternative: string };

/**
 * SPM-22: Venue Staff approve or reject a booking request.
 *
 * Who is deciding comes from `getCurrentVenueStaff()` on the server, never from
 * the form. A broken business rule -- no reason, already decided, a clash --
 * comes back as a message with what was typed; anything else is a genuine
 * fault for the error boundary. On success the page re-renders and shows the
 * outcome, so there is no success state to return.
 */
export async function decideBookingRequestAction(
  _previous: DecideBookingRequestState,
  formData: FormData,
): Promise<DecideBookingRequestState> {
  const note = String(formData.get("note") ?? "");
  const alternative = String(formData.get("alternative") ?? "");

  const parsed = decideBookingRequestSchema.safeParse({
    bookingId: String(formData.get("bookingId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    note,
    alternative,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the decision.",
      note,
      alternative,
    };
  }

  const { bookingId, decision } = parsed.data;

  try {
    // Not Venue Staff gets the same answer as no such booking (#91).
    const staff = await getCurrentVenueStaff();
    if (staff === null) {
      throw new BookingNotFoundError(bookingId);
    }

    const decideBookingRequest = await buildDecideBookingRequest();
    await decideBookingRequest.execute(
      decision === "approve"
        ? { bookingId, userAccountId: staff.userAccountId, decision }
        : {
            bookingId,
            userAccountId: staff.userAccountId,
            decision,
            reason: parsed.data.note,
            suggestedAlternative: parsed.data.alternative,
          },
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, note, alternative };
    }
    throw error;
  }

  revalidatePath("/staff/venue", "layout");
  return { status: "idle" };
}
