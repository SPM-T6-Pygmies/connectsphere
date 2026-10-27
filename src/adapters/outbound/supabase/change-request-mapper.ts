import type { ChangeRequestTarget, RequestedChange } from "@/core/domain/change-request";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";

import { toStatus } from "./coordinator-event-mapper";

/** One row of `organiser_change_request_target`. */
export interface ChangeRequestTargetRow {
  readonly event_id: number;
  readonly status: string;
  readonly owning_organiser_user_account_id: number;
  readonly has_open_change_request: boolean;
}

/** One element of `submit_change_request`'s `p_items`. */
export interface ChangeRequestItemArg {
  readonly field_name: string;
  readonly requested_value: string | null;
}

export function toChangeRequestTarget(row: ChangeRequestTargetRow): ChangeRequestTarget {
  return {
    eventId: eventId(String(row.event_id)),
    status: toStatus(row.status),
    owningOrganiserUserAccountId: userAccountId(String(row.owning_organiser_user_account_id)),
    hasOpenChangeRequest: row.has_open_change_request,
  };
}

/**
 * `requested_value` is text: times and registration as JSON, attendance as a
 * number, venue and equipment as written. Null is "Not applicable", which the
 * table allows only for equipment and registration.
 */
export function toChangeRequestItem(change: RequestedChange): ChangeRequestItemArg {
  switch (change.field) {
    case "times":
      return { field_name: change.field, requested_value: JSON.stringify(change.value) };
    case "expected_attendance":
      return { field_name: change.field, requested_value: String(change.value) };
    case "venue_requirements":
    case "equipment_requirements":
      return { field_name: change.field, requested_value: change.value };
    case "registration":
      return {
        field_name: change.field,
        requested_value: change.value === null ? null : JSON.stringify(change.value),
      };
  }
}
