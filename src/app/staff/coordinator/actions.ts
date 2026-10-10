"use server";

import { revalidatePath } from "next/cache";

import { completeEventSchema } from "@/adapters/inbound/complete-event-schema";
import { confirmEventSchema } from "@/adapters/inbound/confirm-event-schema";
import { decideEventRequestSchema } from "@/adapters/inbound/decide-event-request-schema";
import { postClarificationMessageSchema } from "@/adapters/inbound/post-clarification-message-schema";
import {
  requestClarificationSchema,
  resolveClarificationThreadSchema,
} from "@/adapters/inbound/request-clarification-schema";
import { resubmitForSafetyCheckSchema } from "@/adapters/inbound/resubmit-for-safety-check-schema";
import { setEventRegistrationSchema } from "@/adapters/inbound/set-event-registration-schema";
import { updateEventDetailsSchema } from "@/adapters/inbound/update-event-details-schema";
import { withdrawEventRequestSchema } from "@/adapters/inbound/withdraw-event-request-schema";
import {
  buildCompleteEvent,
  buildConfirmEvent,
  buildDecideEventRequest,
  buildPostCoordinatorClarificationMessage,
  buildRequestClarification,
  buildResolveClarificationThread,
  buildResubmitForSafetyCheck,
  buildSetEventRegistration,
  buildUpdateEventDetails,
  buildWithdrawEventRequest,
  getCurrentCoordinator,
} from "@/composition/container";
import {
  CoordinatorEventNotFoundError,
  DomainError,
  EventNotFoundError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";

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

export type WithdrawEventRequestState =
  | { status: "idle" }
  | { status: "withdrawn" }
  | { status: "error"; message: string; note: string };

/**
 * SPM-101: the assigned Event Coordinator records a withdrawal the Organiser
 * asked for outside the system (#103). Same shape as
 * `decideEventRequestAction`: the coordinator comes from the server, and a
 * refused withdrawal hands back the note that was typed.
 */
export async function withdrawEventRequestAction(
  _previous: WithdrawEventRequestState,
  formData: FormData,
): Promise<WithdrawEventRequestState> {
  const note = String(formData.get("note") ?? "");
  const parsed = withdrawEventRequestSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    note,
  });

  if (!parsed.success) {
    return { status: "error", message: "The event request is missing.", note };
  }

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventRequestNotFoundError(parsed.data.id);
    }

    const withdrawEventRequest = await buildWithdrawEventRequest();
    await withdrawEventRequest.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, note };
    }
    throw error;
  }

  // The request leaves "My requests" for the Archive.
  revalidatePath("/staff/coordinator", "layout");

  return { status: "withdrawn" };
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

export type CompleteEventState =
  | { status: "idle" }
  | { status: "completed" }
  | { status: "error"; message: string; notes: string };

/**
 * SPM-51: the assigned Event Coordinator marks a Confirmed event completed,
 * with any operational notes.
 *
 * The page already disables the button until the event has ended -- this
 * action's own check is defence against a stale page, not the primary way a
 * coordinator finds out. A refusal hands back the notes as typed, because
 * React resets the form after every action.
 */
export async function completeEventAction(
  _previous: CompleteEventState,
  formData: FormData,
): Promise<CompleteEventState> {
  const notes = String(formData.get("notes") ?? "");
  const parsed = completeEventSchema.safeParse({ id: String(formData.get("id") ?? ""), notes });

  if (!parsed.success) {
    return { status: "error", message: "The event is missing.", notes };
  }

  try {
    // Same not-found-shaped scoping as confirming the event (#91).
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new CoordinatorEventNotFoundError(parsed.data.id);
    }

    const completeEvent = await buildCompleteEvent();
    await completeEvent.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, notes };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "completed" };
}

export type ResubmitForSafetyCheckState = { status: "idle" } | { status: "error"; message: string };

/**
 * SPM-261: the assigned coordinator sends a rejected event back for a fresh
 * safety check.
 *
 * Who is resubmitting comes from `getCurrentCoordinator()` on the server; an
 * event that is not theirs is refused like one that does not exist (#91). On
 * success the page re-renders, showing the check as resubmitted.
 */
export async function resubmitForSafetyCheckAction(
  _previous: ResubmitForSafetyCheckState,
  formData: FormData,
): Promise<ResubmitForSafetyCheckState> {
  const parsed = resubmitForSafetyCheckSchema.safeParse({ eventId: String(formData.get("eventId") ?? "") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "The event is missing." };
  }

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new EventNotFoundError(parsed.data.eventId);
    }

    const resubmitForSafetyCheck = await buildResubmitForSafetyCheck();
    await resubmitForSafetyCheck.execute({ ...parsed.data, userAccountId: coordinator.userAccountId });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");
  return { status: "idle" };
}

export type UpdateEventDetailsState =
  | { status: "idle" }
  | { status: "saved"; changed: number }
  | { status: "error"; message: string };

/**
 * SPM-49: the assigned Event Coordinator updates an event's ordinary details.
 * Who is editing comes from `getCurrentCoordinator()` on the server, never
 * from the form, and an event that is not theirs is refused like one that
 * does not exist (#91).
 */
export async function updateEventDetailsAction(
  _previous: UpdateEventDetailsState,
  formData: FormData,
): Promise<UpdateEventDetailsState> {
  const field = (name: string) => String(formData.get(name) ?? "");
  const parsed = updateEventDetailsSchema.safeParse({
    eventId: field("eventId"),
    name: field("name"),
    description: field("description"),
    purpose: field("purpose"),
    categoryType: field("categoryType"),
    programmeAgenda: field("programmeAgenda"),
    specialArrangements: field("specialArrangements"),
    accessibilityRequirements: field("accessibilityRequirements"),
    operationalNotes: field("operationalNotes"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const { eventId, ...details } = parsed.data;
  let changed: number;

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new CoordinatorEventNotFoundError(eventId);
    }

    const updateEventDetails = await buildUpdateEventDetails();
    const result = await updateEventDetails.execute({ eventId, details, ...coordinator });
    changed = result.changed.length;
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "saved", changed };
}

export type SetEventRegistrationState =
  | { status: "idle" }
  | { status: "saved"; changed: boolean }
  | { status: "error"; message: string };

/**
 * SPM-25: the assigned Event Coordinator enables or disables registration and
 * sets its window. Who is saving comes from `getCurrentCoordinator()` on the
 * server, never from the form, and an event that is not theirs is refused
 * like one that does not exist (#91).
 */
export async function setEventRegistrationAction(
  _previous: SetEventRegistrationState,
  formData: FormData,
): Promise<SetEventRegistrationState> {
  const field = (name: string) => String(formData.get(name) ?? "");
  const parsed = setEventRegistrationSchema.safeParse({
    eventId: field("eventId"),
    enabled: field("enabled"),
    opensOn: field("opensOn"),
    closesOn: field("closesOn"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the registration settings." };
  }

  const { eventId, ...settings } = parsed.data;
  let changed: boolean;

  try {
    const coordinator = await getCurrentCoordinator();
    if (coordinator === null) {
      throw new CoordinatorEventNotFoundError(eventId);
    }

    const setEventRegistration = await buildSetEventRegistration();
    const result = await setEventRegistration.execute({ eventId, settings, ...coordinator });
    changed = result.changed;
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/coordinator", "layout");

  return { status: "saved", changed };
}
