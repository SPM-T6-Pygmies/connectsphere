"use server";

import { revalidatePath } from "next/cache";

import { decideEventRequestSchema } from "@/adapters/inbound/decide-event-request-schema";
import { postClarificationMessageSchema } from "@/adapters/inbound/post-clarification-message-schema";
import {
  requestClarificationSchema,
  resolveClarificationSchema,
} from "@/adapters/inbound/request-clarification-schema";
import {
  buildDecideEventRequest,
  buildPostCoordinatorClarificationMessage,
  buildRequestClarification,
  buildResolveClarification,
  getCurrentCoordinator,
} from "@/composition/container";
import { DomainError, EventRequestNotFoundError } from "@/core/domain/errors";

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

export type RequestClarificationState =
  | { status: "idle" }
  | { status: "returned" }
  | { status: "error"; message: string; clarificationMessage: string };

/**
 * SPM-33 AC1-AC3: the assigned Event Coordinator returns a request to its
 * Organiser with a question.
 *
 * Who is asking comes from `getCurrentCoordinator()` on the server, never from
 * the form, for the same reason the decision does: a posted user id would let
 * any caller act as anyone. A Server Action is reachable without its page, so
 * the identity check here is not a duplicate of the page's -- it is the only
 * one that covers this entry point.
 */
export async function requestClarificationAction(
  _previous: RequestClarificationState,
  formData: FormData,
): Promise<RequestClarificationState> {
  const clarificationMessage = String(formData.get("message") ?? "");
  const parsed = requestClarificationSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    message: clarificationMessage,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "That request could not be identified.",
      clarificationMessage,
    };
  }

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventRequestNotFoundError(parsed.data.id);
    }

    const requestClarification = await buildRequestClarification();
    await requestClarification.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, clarificationMessage };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "returned" };
}

export type ResolveClarificationState = { status: "idle" } | { status: "error"; message: string };

/**
 * SPM-33 AC6: the Coordinator marks the clarification resolved, putting the
 * request back to awaiting their own decision.
 *
 * A shortcut out of the waiting-on-the-Organiser label, not a gate in front of
 * deciding -- `decideEventRequestAction` works on a `Returned` request too
 * (decision 4).
 */
export async function resolveClarificationAction(
  _previous: ResolveClarificationState,
  formData: FormData,
): Promise<ResolveClarificationState> {
  const parsed = resolveClarificationSchema.safeParse({ id: String(formData.get("id") ?? "") });

  if (!parsed.success) {
    return { status: "error", message: "That request could not be identified." };
  }

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventRequestNotFoundError(parsed.data.id);
    }

    const resolveClarification = await buildResolveClarification();
    await resolveClarification.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "idle" };
}

export type PostClarificationMessageState =
  | { status: "idle" }
  | { status: "error"; message: string };

/**
 * SPM-33 AC5: the assigned Coordinator says something more on the thread.
 *
 * Not a second return: a follow-up leaves the status exactly where it is
 * (decision 3), which is what lets the two sides talk as long as they need to.
 */
export async function postClarificationMessageAction(
  _previous: PostClarificationMessageState,
  formData: FormData,
): Promise<PostClarificationMessageState> {
  const parsed = postClarificationMessageSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    body: String(formData.get("body") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: "That request could not be identified." };
  }

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventRequestNotFoundError(parsed.data.id);
    }

    const postMessage = await buildPostCoordinatorClarificationMessage();
    await postMessage.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "idle" };
}
