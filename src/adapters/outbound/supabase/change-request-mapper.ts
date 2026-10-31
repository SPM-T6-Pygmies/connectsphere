import {
  changeRequestId,
  type ChangeRequest,
  type ChangeRequestField,
  type ChangeRequestItem,
  type ChangeRequestTarget,
  type ItemDecisionState,
  type RequestedChange,
} from "@/core/domain/change-request";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";

import { toStatus } from "./coordinator-event-mapper";

/** One row of `organiser_change_request_target`. */
export interface ChangeRequestTargetRow {
  readonly event_id: number;
  readonly status: string;
  readonly owning_organiser_user_account_id: number;
  readonly has_open_change_request: boolean;
  readonly event_name: string;
  readonly assigned_coordinator_user_account_id: number | null;
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
    eventName: row.event_name,
    assignedCoordinatorUserAccountId:
      row.assigned_coordinator_user_account_id === null
        ? null
        : userAccountId(String(row.assigned_coordinator_user_account_id)),
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

/** One row of `coordinator_event_change_requests`. */
export interface ChangeRequestRow {
  readonly change_request_id: number;
  readonly created_at: string;
  readonly items: readonly ChangeRequestItemRow[];
  readonly requesting_user_account_id: number;
}

export interface ChangeRequestItemRow {
  readonly field_name: string;
  readonly requested_value: string | null;
  readonly decision: string;
  readonly decision_reason: string | null;
}

/** One element of `coordinator_decide_change_request`'s `p_decisions`. */
export interface ChangeRequestDecisionArg {
  readonly field_name: ChangeRequestField;
  readonly decision: "Accepted" | "Rejected";
  readonly decision_reason: string | null;
}

/** The store spells a declined item `Rejected`. */
const DECISIONS: Readonly<Record<string, ItemDecisionState>> = {
  Pending: "Pending",
  Accepted: "Accepted",
  Rejected: "Declined",
};

export function toChangeRequest(row: ChangeRequestRow): ChangeRequest {
  return {
    id: changeRequestId(String(row.change_request_id)),
    submittedAt: new Date(row.created_at),
    requestedBy: userAccountId(String(row.requesting_user_account_id)),
    items: row.items.map(toChangeRequestItemState),
  };
}

function toChangeRequestItemState(row: ChangeRequestItemRow): ChangeRequestItem {
  const decision = DECISIONS[row.decision];
  if (decision === undefined) {
    throw new Error(`Unknown change request decision: ${row.decision}`);
  }
  const change = toRequestedChange(row);
  // coordinator_decide_change_request refuses a Rejected item without a reason.
  return decision === "Declined"
    ? { change, decision, reason: row.decision_reason ?? "" }
    : { change, decision, reason: null };
}

/** The reverse of `toChangeRequestItem`. */
export function toRequestedChange(row: Pick<ChangeRequestItemRow, "field_name" | "requested_value">): RequestedChange {
  const value = row.requested_value;
  switch (row.field_name) {
    case "times":
      return { field: "times", value: JSON.parse(value ?? "[]") };
    case "expected_attendance":
      return { field: "expected_attendance", value: Number(value) };
    case "venue_requirements":
      return { field: "venue_requirements", value: value ?? "" };
    case "equipment_requirements":
      return { field: "equipment_requirements", value };
    case "registration":
      return { field: "registration", value: value === null ? null : JSON.parse(value) };
    default:
      throw new Error(`Unknown change request field: ${row.field_name}`);
  }
}

/** Only decided items are sent; the function refuses a request left partly Pending. */
export function toDecisionArg(item: ChangeRequestItem): ChangeRequestDecisionArg {
  return {
    field_name: item.change.field,
    decision: item.decision === "Declined" ? "Rejected" : "Accepted",
    decision_reason: item.decision === "Declined" ? item.reason : null,
  };
}
