import { eventId } from "@/core/domain/event";
import type { ArrangementType, LapseCause, LapsedArrangement } from "@/core/domain/event-readiness";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type { ConfirmationLapses, EventConfirmationLapse } from "@/core/ports/outbound/confirmation-lapses";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";

/** One row of `confirmation_lapses`. */
export interface ConfirmationLapseRow {
  readonly event_id: number;
  readonly event_name: string;
  readonly event_request_id: number | null;
  readonly owning_organiser_user_account_id: number;
  readonly lapsed: readonly LapsedArrangementRow[];
}

/** One element of `lapse_event_confirmation`'s result, as stored. */
export type LapsedArrangementRow =
  | { readonly kind: "arrangement"; readonly type: string }
  | { readonly kind: "equipment"; readonly equipment_type: string }
  | { readonly kind: "flagged-booking"; readonly venue_location: string }
  | { readonly kind: "safety-check" };

function toLapsedArrangement(row: LapsedArrangementRow): LapsedArrangement {
  switch (row.kind) {
    case "arrangement":
      return { kind: "arrangement", type: row.type as ArrangementType };
    case "equipment":
      return { kind: "equipment", equipmentType: row.equipment_type };
    case "flagged-booking":
      return { kind: "flagged-booking", venueLocation: row.venue_location };
    case "safety-check":
      return { kind: "safety-check" };
  }
}

export function toEventConfirmationLapse(row: ConfirmationLapseRow): EventConfirmationLapse {
  return {
    eventId: eventId(String(row.event_id)),
    eventName: row.event_name,
    eventRequestId: row.event_request_id === null ? null : String(row.event_request_id),
    owningOrganiserUserAccountId: userAccountId(String(row.owning_organiser_user_account_id)),
    lapsed: row.lapsed.map(toLapsedArrangement),
  };
}

/**
 * Reached through `confirmation_lapses`, a `security definer` function over
 * `event_confirmation_lapse`, which has RLS enabled with no policy. It answers
 * only the lapsed event's coordinator or Venue Staff (#91).
 */
export class SupabaseConfirmationLapses implements ConfirmationLapses {
  constructor(private readonly client: SupabaseServerClient) {}

  async causedBy(
    reader: UserAccountId,
    cause: LapseCause,
    sourceRef: string,
  ): Promise<readonly EventConfirmationLapse[]> {
    const readerKey = toKey(reader);
    if (readerKey === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("confirmation_lapses", {
      p_reader_user_account_id: readerKey,
      p_cause: cause,
      p_source_ref: sourceRef,
    });
    if (error) {
      throw new Error(`Failed to read the confirmation lapses: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as ConfirmationLapseRow[]).map(toEventConfirmationLapse);
  }
}
