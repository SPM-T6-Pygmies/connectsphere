import type { LayoutCapacityCheck } from "@/core/domain/booking";

export type CapacityTone = "ok" | "over" | "unknown";

/**
 * SPM-104: the capacity check in the Coordinator's words. Presentation only --
 * the verdict itself is `checkLayoutCapacity`'s. "Over" is shown, never
 * enforced: whether it blocks a request is still open (SPM-107).
 */
export function describeCapacity(check: LayoutCapacityCheck): {
  tone: CapacityTone;
  text: string;
} {
  if (check.layout === null) {
    return {
      tone: "unknown",
      text: "No layout recorded, so no capacity to check",
    };
  }
  if (check.capacity === null) {
    return {
      tone: "unknown",
      text: `${check.layout} is no longer listed by this venue`,
    };
  }

  const seats = `${check.layout} seats ${check.capacity}`;
  if (check.expectedAttendance === null || check.withinCapacity === null) {
    return {
      tone: "unknown",
      text: `${seats} · no expected attendance on the event yet`,
    };
  }
  if (check.withinCapacity) {
    return {
      tone: "ok",
      text: `${seats} · fits the ${check.expectedAttendance} expected`,
    };
  }
  return {
    tone: "over",
    text: `${seats} · ${check.expectedAttendance} expected, ${check.expectedAttendance - check.capacity} over`,
  };
}
