"use server";

import { revalidatePath } from "next/cache";

import { decideEventRequestSchema } from "@/adapters/inbound/decide-event-request-schema";
import { actingCoordinator, buildDecideEventRequest } from "@/composition/container";
import { DomainError } from "@/core/domain/errors";

export type DecideEventRequestState =
  | { status: "idle" }
  | { status: "decided" }
  | { status: "error"; message: string; decisionRecord: string };

/**
 * SPM-34: the assigned Event Coordinator approves or rejects a request.
 *
 * Who is deciding comes from `actingCoordinator()` on the server, never from
 * the form -- a posted user id would let any caller decide as anyone. A
 * refused decision hands back what was typed, because React resets the form
 * after every action, failed ones included.
 */
export async function decideEventRequestAction(
  _previous: DecideEventRequestState,
  formData: FormData,
): Promise<DecideEventRequestState> {
  const decisionRecord = String(formData.get("decisionRecord") ?? "");
  const parsed = decideEventRequestSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    decisionRecord,
  });

  if (!parsed.success) {
    return { status: "error", message: "Choose Approve or Reject.", decisionRecord };
  }

  try {
    const decideEventRequest = await buildDecideEventRequest();
    await decideEventRequest.execute({ ...parsed.data, ...actingCoordinator() });
  } catch (error) {
    // A broken rule is an expected outcome and becomes a message. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, decisionRecord };
    }
    throw error;
  }

  // The queue, the sidebar, this detail and its notification-inbox twin all
  // read the request that was just decided.
  revalidatePath("/staff/coordinator", "layout");

  return { status: "decided" };
}
