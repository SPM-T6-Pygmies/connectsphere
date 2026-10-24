import type { BookingId } from "@/core/domain/booking";
import type { ExpiredHold, ExpiredHoldNotices } from "@/core/ports/outbound/expired-hold-notices";

import { toBookingTimes } from "./booking-mapper";
import type { SupabaseAdminClient } from "./client";
import type { EventSlotTimeRow } from "./event-mapper";

/** One row `claim_expired_hold_notices()` returns. */
interface ExpiredHoldRow {
  booking_id: number;
  event_id: number;
  event_request_id: number | null;
  event_name: string;
  coordinator_user_account_id: number | null;
  venue_location: string;
  hold_expires_at: string;
  slots: readonly EventSlotTimeRow[];
}

/**
 * SPM-254, using the service-role-only function in
 * 20261019000400_hold_expiry_notices.sql. The page render that triggers the
 * sweep may belong to any staff member, and none of them may read other
 * people's events themselves.
 */
export class SupabaseExpiredHoldNotices implements ExpiredHoldNotices {
  constructor(private readonly client: SupabaseAdminClient) {}

  async claim(): Promise<readonly ExpiredHold[]> {
    const { data, error } = await this.client.rpc("claim_expired_hold_notices");
    if (error) {
      throw new Error(`Failed to claim expired hold notices: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as ExpiredHoldRow[]).map((row) => ({
      bookingId: String(row.booking_id) as BookingId,
      eventId: String(row.event_id),
      eventRequestId: row.event_request_id === null ? null : String(row.event_request_id),
      eventName: row.event_name,
      coordinatorUserAccountId:
        row.coordinator_user_account_id === null ? null : String(row.coordinator_user_account_id),
      venueLocation: row.venue_location,
      times: toBookingTimes(row.slots),
      holdExpiresAt: row.hold_expires_at,
    }));
  }
}
