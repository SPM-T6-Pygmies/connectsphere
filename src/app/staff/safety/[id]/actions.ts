"use server";

import { revalidatePath } from "next/cache";

import { recordSafetyCheckSchema } from "@/adapters/inbound/record-safety-check-schema";
import { buildRecordSafetyCheck, getCurrentSafetyOfficer } from "@/composition/container";
import { DomainError, NotSafetyOfficerError } from "@/core/domain/errors";

export type RecordSafetyCheckState = { status: "idle" } | { status: "error"; message: string; comments: string };

/**
 * SPM-260: a Safety Officer records Approved or Rejected on an event.
 *
 * Who is recording comes from `getCurrentSafetyOfficer()` on the server, never
 * from the form. A broken business rule -- a bare rejection, an event no longer
 * awaiting a check -- comes back as a message with what was typed; anything
 * else is a genuine fault for the error boundary. On success the page
 * re-renders showing the outcome, so there is no success state to return.
 */
export async function recordSafetyCheckAction(
  _previous: RecordSafetyCheckState,
  formData: FormData,
): Promise<RecordSafetyCheckState> {
  const comments = String(formData.get("comments") ?? "");

  const parsed = recordSafetyCheckSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    outcome: String(formData.get("outcome") ?? ""),
    comments,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the outcome.", comments };
  }

  try {
    const officer = await getCurrentSafetyOfficer();
    if (officer === null) {
      throw new NotSafetyOfficerError();
    }

    const recordSafetyCheck = await buildRecordSafetyCheck();
    await recordSafetyCheck.execute({ userAccountId: officer.userAccountId, ...parsed.data });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, comments };
    }
    throw error;
  }

  revalidatePath("/staff/safety", "layout");
  return { status: "idle" };
}
