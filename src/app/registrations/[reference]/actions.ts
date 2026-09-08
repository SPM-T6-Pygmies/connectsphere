"use server";

import { withdrawRegistrationSchema } from "@/adapters/inbound/withdraw-registration-schema";
import { buildWithdrawRegistration } from "@/composition/container";
import { DomainError } from "@/core/domain/errors";
import type { AttendeeRegistration } from "@/core/ports/inbound/attendee-registration";

export type WithdrawalState =
  | { status: "idle" }
  | { status: "withdrawn"; registration: AttendeeRegistration }
  | { status: "error"; message: string };

/**
 * A driving adapter, and nothing more: parse, call the use case, translate.
 *
 * A Server Action rather than a link, deliberately. Withdrawal behind a GET
 * would be triggered by anything that follows links on the page's behalf --
 * a prefetcher, a link scanner, a mail client checking a URL -- and the
 * attendee would lose their place without ever clicking.
 */
export async function withdrawRegistrationAction(
  _previous: WithdrawalState,
  formData: FormData,
): Promise<WithdrawalState> {
  const parsed = withdrawRegistrationSchema.safeParse({
    reference: formData.get("reference"),
  });

  if (!parsed.success) {
    return { status: "error", message: "That registration link is not valid." };
  }

  try {
    const withdrawRegistration = await buildWithdrawRegistration();
    const result = await withdrawRegistration.execute(parsed.data);

    return { status: "withdrawn", registration: result.registration };
  } catch (error) {
    // A refused withdrawal -- already withdrawn, event completed -- is an
    // expected outcome and becomes a message the attendee can act on. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
