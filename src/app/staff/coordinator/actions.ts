"use server";

import { revalidatePath } from "next/cache";

import { confirmEventSchema } from "@/adapters/inbound/confirm-event-schema";
import { decideEventRequestSchema } from "@/adapters/inbound/decide-event-request-schema";
import {
  buildConfirmEvent,
  buildDecideEventRequest,
  getCurrentCoordinator,
} from "@/composition/container";
import { DomainError, EventNotFoundError, EventRequestNotFoundError } from "@/core/domain/errors";

export type DecideEventRequestState =
  | { status: "idle" }
  | { status: "decided" }
  | { status: "error"; message: string; decisionRecord: string };

/**
 * SPM-34: the assigned Event Coordinator approves or rejects a request.
 *
 * Who is deciding comes from `getCurrentCoordinator()` on the server, never from
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
    // A caller who isn't a coordinator gets the same answer as one who isn't
    // assigned to this request (#91), as the coordinator pages do.
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventRequestNotFoundError(parsed.data.id);
    }

    const decideEventRequest = await buildDecideEventRequest();
    await decideEventRequest.execute({ ...parsed.data, ...coordinator });
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

export type ConfirmEventState =
  | { status: "idle" }
  | { status: "confirmed" }
  | { status: "error"; message: string };

/**
 * SPM-50: the assigned Event Coordinator confirms an event.
 *
 * The page already computes and disables the button when something essential
 * is incomplete -- this action's own check is defence against a change that
 * landed between that read and this submit, not the primary way a coordinator
 * finds out what's blocking.
 */
export async function confirmEventAction(
  _previous: ConfirmEventState,
  formData: FormData,
): Promise<ConfirmEventState> {
  const parsed = confirmEventSchema.safeParse({ id: String(formData.get("id") ?? "") });

  if (!parsed.success) {
    return { status: "error", message: "The event is missing." };
  }

  try {
    // Same not-found-shaped scoping as deciding a request (#91).
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventNotFoundError(parsed.data.id);
    }

    const confirmEvent = await buildConfirmEvent();
    await confirmEvent.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "confirmed" };
}
