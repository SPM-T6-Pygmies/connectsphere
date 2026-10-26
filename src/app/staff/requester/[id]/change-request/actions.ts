"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { submitChangeRequestSchema } from "@/adapters/inbound/submit-change-request-schema";
import { buildSubmitChangeRequest, getCurrentOrganiser } from "@/composition/container";
import { DomainError, EventRequestNotFoundError, InvalidChangeRequestError } from "@/core/domain/errors";

export type SubmitChangeRequestState =
  | { status: "idle" }
  | { status: "error"; message: string; field: string | null };

/**
 * SPM-52: the event's owning Organiser submits a change request.
 *
 * Who is asking comes from `getCurrentOrganiser()` on the server, never from
 * the form. A Server Action is reachable without its page, so this check is
 * the one that covers this entry point, as the other requester actions do.
 */
export async function submitChangeRequestAction(
  _previous: SubmitChangeRequestState,
  formData: FormData,
): Promise<SubmitChangeRequestState> {
  const parsed = submitChangeRequestSchema.safeParse({
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
    changes: String(formData.get("changes") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: "That change request could not be read.", field: null };
  }

  try {
    const organiser = await getCurrentOrganiser();
    if (organiser === null) {
      throw new EventRequestNotFoundError(parsed.data.eventRequestId);
    }

    const submitChangeRequest = await buildSubmitChangeRequest();
    await submitChangeRequest.execute({
      eventRequestId: parsed.data.eventRequestId,
      userAccountId: organiser.userAccountId,
      changes: parsed.data.changes,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        status: "error",
        message: error.message,
        field: error instanceof InvalidChangeRequestError ? error.field : null,
      };
    }
    throw error;
  }

  revalidatePath("/staff/requester", "layout");
  redirect(`/staff/requester/${parsed.data.eventRequestId}`);
}
