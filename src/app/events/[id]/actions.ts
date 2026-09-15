"use server";

import { z } from "zod";

import { registerForEventSchema } from "@/adapters/inbound/register-for-event-schema";
import { buildRegisterForEvent } from "@/composition/container";
import { DomainError } from "@/core/domain/errors";
import type { AvailableEvent } from "@/core/use-cases/available-event";

export type RegistrationState =
  | { status: "idle" }
  | { status: "registered"; registrationId: string; event: AvailableEvent }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** Echoed back so a refused attempt does not make the attendee retype. */
      values: { fullName: string; email: string };
    };

export async function registerForEventAction(
  _previous: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const submitted = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  const parsed = registerForEventSchema.safeParse({
    eventId: formData.get("eventId"),
    ...submitted,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: submitted,
    };
  }

  try {
    const registerForEvent = await buildRegisterForEvent();
    const result = await registerForEvent.execute(parsed.data);

    return { status: "registered", registrationId: result.registrationId, event: result.event };
  } catch (error) {
    // A refused registration -- full, closed, already registered -- is an
    // expected outcome and becomes a message the attendee can act on. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, values: submitted };
    }
    throw error;
  }
}
