import type { BookingId } from "@/core/domain/booking";
import { BookingNotFoundError, NoFlagToClearError } from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type { BookingFlagRepository, EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";

import { toEventBookingFlag, type EventBookingFlagRow } from "./booking-flag-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./to-key";

// SQLSTATEs raised by coordinator_clear_booking_flags (CS026 is shared with the other booking writes).
const BOOKING_NOT_FOUND = "CS026";
const NO_FLAG_TO_CLEAR = "CS083";

/**
 * Reached through `coordinator_event_flags`, a `security definer` function: the flag table
 * has RLS enabled with no policy. The function answers only for the event's assigned
 * coordinator, so another coordinator's call gets nothing back (#91). Clearing goes through
 * `coordinator_clear_booking_flags` the same way (SPM-310).
 */
export class SupabaseBookingFlagRepository implements BookingFlagRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async openForEvent(coordinatorId: UserAccountId, eventId: string): Promise<readonly EventBookingFlag[]> {
    const coordinator = toKey(coordinatorId);
    const event = toKey(eventId);
    if (coordinator === null || event === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("coordinator_event_flags", {
      p_coordinator_user_account_id: coordinator,
      p_event_id: event,
    });
    if (error) {
      throw new Error(`Failed to read the event's flags: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as EventBookingFlagRow[]).map(toEventBookingFlag);
  }

  async clear(coordinatorId: UserAccountId, bookingId: BookingId): Promise<void> {
    const coordinator = toKey(coordinatorId);
    const booking = toKey(bookingId);
    if (coordinator === null || booking === null) {
      // No row this store issued has an id like that.
      throw new BookingNotFoundError(bookingId);
    }

    const { error } = await this.client.rpc("coordinator_clear_booking_flags", {
      p_coordinator_user_account_id: coordinator,
      p_booking_id: booking,
    });
    if (error) {
      switch (error.code) {
        case BOOKING_NOT_FOUND:
          throw new BookingNotFoundError(bookingId);
        case NO_FLAG_TO_CLEAR:
          // The use case read it open a moment ago; it was cleared or closed since.
          throw new NoFlagToClearError(bookingId);
        default:
          throw new Error(`Failed to clear the booking's flag: ${error.message}`, { cause: error });
      }
    }
  }
}
