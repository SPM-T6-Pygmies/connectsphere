import type { CoordinatorEventStatus } from "./coordinator-event";
import { InvalidEventDetailsError } from "./errors";
import { eventFacilitiesEditable } from "./event-facilities";
import { ACCESSIBILITY_OPTIONS, formatOptionList, parseOptionList } from "./venue-options";

/**
 * SPM-49: the event fields the assigned coordinator may change directly
 * (#4 "ordinary" edits). Nothing else on the event depends on them.
 *
 * Every other planning field -- date and slots, expected attendance, venue
 * requirements, facilities, room layout, equipment and technical support --
 * is "significant": venue bookings, equipment reservations and safety checks
 * depend on it, so it changes only through a change request (SPM-52).
 */
export const ORDINARY_EVENT_FIELDS = [
  "name",
  "description",
  "purpose",
  "categoryType",
  "programmeAgenda",
  "specialArrangements",
  "accessibilityRequirements",
  "operationalNotes",
] as const;

export type OrdinaryEventField = (typeof ORDINARY_EVENT_FIELDS)[number];

/** The ordinary details as stored: free text, null when blank, except the name, which an event always has. */
export type OrdinaryEventDetails = { readonly name: string } & {
  readonly [field in Exclude<OrdinaryEventField, "name">]: string | null;
};

/** What changes, field by field. Empty when the edit changes nothing. */
export type OrdinaryEventChanges = Partial<OrdinaryEventDetails>;

/** Same window as the facilities: until the event is Completed or Cancelled. */
export function eventDetailsEditable(status: CoordinatorEventStatus): boolean {
  return eventFacilitiesEditable(status);
}

function normalise(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The fields `proposed` changes from `current`, trimmed, blanks stored as null.
 *
 * The coordinator has full control of these fields, so any of them may be
 * cleared -- even the programme agenda on a Confirmed event. Only two rules
 * hold: an event always has a name, and accessibility, which venues are
 * matched against, must come from the accessibility list. Both are checked
 * only when the field actually changes, so an older free-text value can be
 * kept while something else is edited.
 */
export function planOrdinaryEdit(
  current: OrdinaryEventDetails,
  proposed: OrdinaryEventDetails,
): OrdinaryEventChanges {
  const changes: Record<string, string | null> = {};

  for (const field of ORDINARY_EVENT_FIELDS) {
    const next = normalise(proposed[field]);
    if (next === normalise(current[field])) {
      continue;
    }
    if (field === "name" && next === null) {
      throw new InvalidEventDetailsError("An event must have a name.");
    }
    changes[field] = field === "accessibilityRequirements" ? chooseAccessibility(next) : next;
  }

  return changes as OrdinaryEventChanges;
}

function chooseAccessibility(value: string | null): string | null {
  const chosen = new Set(parseOptionList(value));
  const unknown = [...chosen].filter(
    (option) => !(ACCESSIBILITY_OPTIONS as readonly string[]).includes(option),
  );
  if (unknown.length > 0) {
    throw new InvalidEventDetailsError(
      `${unknown.join(", ")} is not an accessibility option -- choose from ${ACCESSIBILITY_OPTIONS.join(", ")}.`,
    );
  }
  const ordered = ACCESSIBILITY_OPTIONS.filter((option) => chosen.has(option));
  return ordered.length === 0 ? null : formatOptionList(ordered);
}
