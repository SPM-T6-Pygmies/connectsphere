"use client";

import { EventTimes } from "@/app/events/event-times";
import type { ChangeRequestField, RequestedChange } from "@/core/domain/change-request";
import type { RegistrationSettings } from "@/core/domain/event-registration-settings";

function registration(settings: RegistrationSettings): string {
  if (!settings.enabled) {
    return "Off";
  }
  return `Open ${settings.opensOn ?? "—"} to ${settings.closesOn ?? "—"}`;
}

/**
 * One field's value as a person reads it: times in the viewer's timezone
 * (SPM-400), and `null` as "Not applicable" for the fields that allow it.
 */
export function ChangeValue({ change }: { change: RequestedChange }) {
  switch (change.field) {
    case "times":
      return <EventTimes times={change.value} nameEveryDay />;
    case "venue_requirements":
      return <>{change.value || "—"}</>;
    case "expected_attendance":
      return <>{change.value}</>;
    case "equipment_requirements":
      return <>{change.value === null ? "Not applicable" : change.value || "—"}</>;
    case "registration":
      return <>{change.value === null ? "Not applicable" : registration(change.value)}</>;
  }
}

/** The event's value now, which can be empty where the request's cannot. */
export function CurrentValue({ field, value }: { field: ChangeRequestField; value: unknown }) {
  if (value === null || value === "") {
    return <>—</>;
  }
  return <ChangeValue change={{ field, value } as RequestedChange} />;
}
