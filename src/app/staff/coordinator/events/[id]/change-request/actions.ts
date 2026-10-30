"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { decideChangeRequestSchema } from "@/adapters/inbound/decide-change-request-schema";
import { buildDecideChangeRequest, getCurrentCoordinator } from "@/composition/container";
import { ChangeRequestNotFoundError, DomainError, InvalidChangeRequestDecisionError } from "@/core/domain/errors";

export type DecideChangeRequestState =
  | { status: "idle" }
  | { status: "error"; message: string; field: string | null };

/**
 * SPM-100: the event's assigned Coordinator decides a change request.
 *
 * Who is deciding comes from `getCurrentCoordinator()` on the server, never
 * from the form. A Server Action is reachable without its page, so this check
 * is the one that covers this entry point.
 */
export async function decideChangeRequestAction(
  _previous: DecideChangeRequestState,
  formData: FormData,
): Promise<DecideChangeRequestState> {
  const parsed = decideChangeRequestSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    changeRequestId: String(formData.get("changeRequestId") ?? ""),
    decisions: String(formData.get("decisions") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: "That decision could not be read.", field: null };
  }

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new ChangeRequestNotFoundError(parsed.data.changeRequestId);
    }

    const decideChangeRequest = await buildDecideChangeRequest();
    await decideChangeRequest.execute({
      eventId: parsed.data.eventId,
      changeRequestId: parsed.data.changeRequestId,
      userAccountId: coordinator.userAccountId,
      decisions: parsed.data.decisions,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        status: "error",
        message: error.message,
        field: error instanceof InvalidChangeRequestDecisionError ? error.field : null,
      };
    }
    throw error;
  }

  revalidatePath(`/staff/coordinator/events/${parsed.data.eventId}`, "layout");
  redirect(`/staff/coordinator/events/${parsed.data.eventId}/change-request`);
}
