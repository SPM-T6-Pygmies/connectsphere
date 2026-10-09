import { checkLayoutCapacity, type BookingStatus } from "./booking";
import type { Venue } from "./venue";
import { parseOptionList } from "./venue-options";

/**
 * SPM-45: does a venue fit an event's needs as they are now? Advice only --
 * nothing here blocks a request (AC3).
 */
export interface EventNeeds {
  readonly expectedAttendance: number | null;
  readonly preferredLayout: string | null;
  /** Stored as the venue's accessibility is: labels joined by commas. */
  readonly accessibilityNeeds: string | null;
  readonly requiredFacilities: string | null;
}

export type SuitabilityCheck = "layout" | "capacity" | "accessibility" | "facilities";
export type SuitabilityStatus = "pass" | "fail" | "unknown";
export type SuitabilityOverall = "Suitable" | "Not suitable" | "Check incomplete";

export interface SuitabilityRow {
  readonly check: SuitabilityCheck;
  readonly status: SuitabilityStatus;
  readonly detail: string;
}

export interface VenueSuitability {
  readonly rows: readonly SuitabilityRow[];
  readonly overall: SuitabilityOverall;
  /** The rows that failed, in row order -- empty unless `overall` is "Not suitable". */
  readonly failing: readonly SuitabilityCheck[];
}

export function checkVenueSuitability(
  venue: Venue,
  layoutBeingBooked: string | null,
  needs: EventNeeds,
): VenueSuitability {
  const rows = [
    layoutRow(venue, needs),
    capacityRow(venue, layoutBeingBooked ?? needs.preferredLayout, needs.expectedAttendance),
    listRow("accessibility", venue.accessibility, needs.accessibilityNeeds),
    listRow("facilities", venue.facilities, needs.requiredFacilities),
  ];
  const failing = rows.filter((row) => row.status === "fail").map((row) => row.check);
  const overall: SuitabilityOverall =
    failing.length > 0
      ? "Not suitable"
      : rows.some((row) => row.status === "unknown")
        ? "Check incomplete"
        : "Suitable";
  return { rows, overall, failing };
}

function layoutRow(venue: Venue, needs: EventNeeds): SuitabilityRow {
  const wanted = needs.preferredLayout;
  if (wanted === null) {
    return { check: "layout", status: "unknown", detail: "Not stated" };
  }
  return venue.layouts.some((layout) => layout.name === wanted)
    ? { check: "layout", status: "pass", detail: `Offers ${wanted}` }
    : { check: "layout", status: "fail", detail: `Doesn't offer ${wanted}` };
}

/** Compared with the seats of the layout, never the venue-wide figure (#112). */
function capacityRow(venue: Venue, layout: string | null, attendance: number | null): SuitabilityRow {
  const { capacity, withinCapacity } = checkLayoutCapacity(venue, layout, attendance);
  if (withinCapacity === null || capacity === null || attendance === null) {
    return { check: "capacity", status: "unknown", detail: "Not known yet" };
  }
  return withinCapacity
    ? { check: "capacity", status: "pass", detail: `${layout} seats ${capacity} · fits the ${attendance} expected` }
    : { check: "capacity", status: "fail", detail: `${layout} seats ${capacity}, ${attendance - capacity} over` };
}

/** Accessibility and facilities follow one rule: the venue must have every item the event needs. */
function listRow(
  check: "accessibility" | "facilities",
  venueHas: string | null,
  eventNeeds: string | null,
): SuitabilityRow {
  const needed = parseOptionList(eventNeeds);
  if (needed.length === 0) {
    return { check, status: "pass", detail: "None needed" };
  }
  const has = parseOptionList(venueHas);
  const missing = needed.filter((item) => !has.includes(item));
  return missing.length === 0
    ? { check, status: "pass", detail: `Has ${needed.join(", ")}` }
    : { check, status: "fail", detail: `Missing: ${missing.join(", ")}` };
}

/**
 * SPM-45 AC8: only a request still in play is checked against the event. A
 * Rejected, Released or Cancelled one is over, so a verdict on it would only mislead.
 */
export function suitabilityApplies(status: BookingStatus): boolean {
  return status === "Requested" || status === "Tentative Hold" || status === "Confirmed";
}
