"use server";

import { revalidatePath } from "next/cache";

import { decideEventRequestSchema } from "@/adapters/inbound/decide-event-request-schema";
import { postClarificationMessageSchema } from "@/adapters/inbound/post-clarification-message-schema";
import {
  requestClarificationSchema,
  resolveClarificationThreadSchema,
} from "@/adapters/inbound/request-clarification-schema";
import {
  buildDecideEventRequest,
  buildPostCoordinatorClarificationMessage,
  buildRequestClarification,
  buildResolveClarificationThread,
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

export type ClarificationComposerState =
  | { status: "idle" }
  | { status: "error"; message: string; body: string };

/**
 * SPM-33 AC1-AC5: the one box the Coordinator says anything in.
 *
 * Which button was pressed decides whether the request moves. "Comment" only
 * appends (AC5); "Comment & return" also returns the request to its Organiser
 * (AC1, AC2). One composer rather than two, because two boxes both headed
 * "Clarification" and both taking a message is the same act twice on one
 * screen -- and the move is on the button rather than implied by posting, so
 * a Coordinator's own sign-off cannot relabel the request as waiting on
 * someone else.
 *
 * A return is always top-level, so `parentId` is only read for a comment: the
 * reply box under a message asks a follow-up in that exchange, while returning
 * opens a new one (`returnEventRequest`).
 *
 * Who is acting comes from `getCurrentCoordinator()` on the server, never from
 * the form -- a posted user id would let any caller act as anyone. A Server
 * Action is reachable without its page, so this identity check is not a
 * duplicate of the page's; it is the only one covering this entry point.
 */
export async function clarificationComposerAction(
  _previous: ClarificationComposerState,
  formData: FormData,
): Promise<ClarificationComposerState> {
  const id = String(formData.get("id") ?? "");
  // React resets the form after every action, so a refusal hands back what was
  // typed rather than losing it.
  const body = String(formData.get("body") ?? "");
  const returning = String(formData.get("intent") ?? "") === "return";

  const parsed = returning
    ? requestClarificationSchema.safeParse({ id, message: body })
    : postClarificationMessageSchema.safeParse({
        id,
        body,
        parentId: String(formData.get("parentId") ?? ""),
      });

  if (!parsed.success) {
    return { status: "error", message: "That request could not be identified.", body };
  }

  try {
    // A caller who isn't a coordinator gets the same answer as one who isn't
    // assigned to this request (#91), as the coordinator pages do.
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventRequestNotFoundError(id);
    }

    if ("message" in parsed.data) {
      const requestClarification = await buildRequestClarification();
      await requestClarification.execute({ ...parsed.data, ...coordinator });
    } else {
      const postMessage = await buildPostCoordinatorClarificationMessage();
      await postMessage.execute({ ...parsed.data, ...coordinator });
    }
  } catch (error) {
    // A broken rule is an expected outcome and becomes a message. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, body };
    }
    throw error;
  }

  // The queue, the sidebar, this detail and its notification-inbox twin all
  // read the request that just moved.
  revalidatePath("/staff/coordinator", "layout");

  return { status: "idle" };
}

export type ResolveClarificationState = { status: "idle" } | { status: "error"; message: string };

/**
 * SPM-33 AC6: the Coordinator marks one question answered.
 *
 * Per question rather than per request: answering one of two outstanding
 * questions is not the same as no longer waiting, so the request only rejoins
 * the decision queue when the last one is cleared. Either way it stays
 * decidable throughout (decision 4).
 *
 * Its own action rather than a button on the composer, because resolving says
 * nothing -- it writes no message (decision 3).
 */
export async function resolveClarificationAction(
  _previous: ResolveClarificationState,
  formData: FormData,
): Promise<ResolveClarificationState> {
  const parsed = resolveClarificationThreadSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    clarificationMessageId: String(formData.get("clarificationMessageId") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: "That request could not be identified." };
  }

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventRequestNotFoundError(parsed.data.id);
    }

    const resolveClarificationThread = await buildResolveClarificationThread();
    await resolveClarificationThread.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "idle" };
}
