import type { CoordinatorEventStatus } from "./coordinator-event";
import { InvalidEventFacilitiesError } from "./errors";
import { FACILITY_OPTIONS, formatOptionList } from "./venue-options";

/**
 * SPM-247: the facilities an event needs, ticked from the same list a venue's
 * facilities come from, so the two can be matched by equality (SPM-45).
 *
 * Returns the text to store, in the list's order and without repeats, or null
 * when none is needed -- which is how a need is cleared.
 */
export function chooseRequiredFacilities(selected: readonly string[]): string | null {
  const chosen = new Set(selected.map((value) => value.trim()).filter((value) => value.length > 0));
  const unknown = [...chosen].filter((value) => !(FACILITY_OPTIONS as readonly string[]).includes(value));
  if (unknown.length > 0) {
    throw new InvalidEventFacilitiesError(
      `${unknown.join(", ")} is not an option -- choose from ${FACILITY_OPTIONS.join(", ")}.`,
    );
  }
  const ordered = FACILITY_OPTIONS.filter((option) => chosen.has(option));
  return ordered.length === 0 ? null : formatOptionList(ordered);
}

/** The facilities can change until the event is Completed or Cancelled. */
export function eventFacilitiesEditable(status: CoordinatorEventStatus): boolean {
  return status === "Planning" || status === "Blocked" || status === "Confirmed";
}
