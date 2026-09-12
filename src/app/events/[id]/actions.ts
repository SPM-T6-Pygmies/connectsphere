"use server";

import {
  registerForEventAction as runRegisterForEvent,
  type RegistrationState,
} from "@/features/registration/register-for-event";

export type { RegistrationState };

/**
 * All that is left of the controller: the "use server" boundary itself.
 *
 * The orchestration moved into the slice at src/features/registration. This
 * wrapper exists because every export of a "use server" module becomes a
 * network-reachable endpoint, and the slice file also exports the deps-taking
 * `registerForEvent` -- which must not become one.
 */
export async function registerForEventAction(
  previous: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  return runRegisterForEvent(previous, formData);
}
