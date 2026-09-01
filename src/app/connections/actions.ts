"use server";

import { z } from "zod";

import { sendConnectionRequestSchema } from "@/adapters/inbound/send-connection-request-schema";
import { buildSendConnectionRequest } from "@/composition/container";
import { DomainError } from "@/core/domain/errors";

export type ConnectionRequestState =
  | { status: "idle" }
  | { status: "sent"; connectionId: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * A driving adapter, and nothing more.
 *
 * Four responsibilities, all of them translation: pull values off FormData,
 * validate their shape, call the use case, turn the outcome into something the
 * UI can render. There is no business rule here to drift out of sync, which is
 * why swapping this for a route handler or a tRPC procedure is a rewrite of
 * this file alone.
 */
export async function sendConnectionRequestAction(
  _previous: ConnectionRequestState,
  formData: FormData,
): Promise<ConnectionRequestState> {
  const parsed = sendConnectionRequestSchema.safeParse({
    requesterId: formData.get("requesterId"),
    addresseeId: formData.get("addresseeId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const sendConnectionRequest = await buildSendConnectionRequest();
    const result = await sendConnectionRequest.execute(parsed.data);

    return { status: "sent", connectionId: result.connectionId };
  } catch (error) {
    // A broken rule is an expected outcome and becomes a message. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
