import { isCalendarDate } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import { InvalidRegistrationSettingsError } from "./errors";
import { eventFacilitiesEditable } from "./event-facilities";

/**
 * SPM-25: whether Attendees can register for an event, and the window they can
 * do it in. Dates are ISO calendar days, `YYYY-MM-DD`, both inclusive.
 */
export interface RegistrationSettings {
  readonly enabled: boolean;
  readonly opensOn: string | null;
  readonly closesOn: string | null;
}

/** Same window as the facilities and details: until the event is Completed or Cancelled. */
export function eventRegistrationEditable(status: CoordinatorEventStatus): boolean {
  return eventFacilitiesEditable(status);
}

function normalise(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The settings to store, or why they cannot be.
 *
 * Enabling needs both dates: `isOpenForRegistration` treats an event with no
 * window as closed, so "enabled" without one would open nothing, and
 * readiness only counts registration as done once both are set. Turning
 * registration off keeps whatever dates were given, so it can be turned back
 * on without retyping them. The window may not run backwards, as
 * `event_registration_window_chk` also insists.
 */
export function chooseRegistrationSettings(proposed: RegistrationSettings): RegistrationSettings {
  const opensOn = normalise(proposed.opensOn);
  const closesOn = normalise(proposed.closesOn);

  for (const date of [opensOn, closesOn]) {
    if (date !== null && !isCalendarDate(date)) {
      throw new InvalidRegistrationSettingsError(`${date} is not a date -- enter it as YYYY-MM-DD.`);
    }
  }
  if (opensOn !== null && closesOn !== null && opensOn > closesOn) {
    throw new InvalidRegistrationSettingsError(
      `Registration can't open (${opensOn}) after it closes (${closesOn}).`,
    );
  }
  if (proposed.enabled && (opensOn === null || closesOn === null)) {
    throw new InvalidRegistrationSettingsError(
      "Set both the opening and closing dates to enable registration.",
    );
  }

  return { enabled: proposed.enabled, opensOn, closesOn };
}

/** Whether saving `next` over `current` would change nothing. */
export function sameRegistrationSettings(current: RegistrationSettings, next: RegistrationSettings): boolean {
  return (
    current.enabled === next.enabled &&
    current.opensOn === next.opensOn &&
    current.closesOn === next.closesOn
  );
}
