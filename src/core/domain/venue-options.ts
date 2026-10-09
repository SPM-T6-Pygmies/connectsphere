/**
 * The values a venue's facilities and accessibility -- and an event request's
 * matching needs -- can take, so a request can be matched against the
 * catalogue by equality rather than by reading free text. Room layouts are
 * `STANDARD_LAYOUTS` in `venue.ts`.
 *
 * Both columns stay text: a selection is stored as its labels joined by
 * `LIST_SEPARATOR`, and `parseOptionList` / `formatOptionList` are the only
 * way in and out of that form.
 */
export const FACILITY_OPTIONS = [
  "Wi-Fi",
  "Breakout rooms",
  "Catering area",
  "Video-conferencing",
] as const;

export const ACCESSIBILITY_OPTIONS = [
  "Step-free access",
  "Hearing loop",
  "Accessible toilets",
  "Lift access",
  "Wheelchair seating",
] as const;

const LIST_SEPARATOR = ", ";

export function parseOptionList(stored: string | null): string[] {
  return (stored ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function formatOptionList(values: readonly string[]): string {
  return values.join(LIST_SEPARATOR);
}

/** The values in `stored` that are not in `allowed` -- empty when the selection is valid. */
export function unknownOptions(stored: string | null, allowed: readonly string[]): string[] {
  return parseOptionList(stored).filter((value) => !allowed.includes(value));
}
