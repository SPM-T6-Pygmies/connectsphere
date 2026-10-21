import type { UserAccountId } from "@/core/domain/user-account";
import type { BookingFlagRepository, EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";

import { toEventBookingFlag, type EventBookingFlagRow } from "./booking-flag-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";

/**
 * Reached through `coordinator_event_flags`, a `security definer` function: the flag table
 * has RLS enabled with no policy. The function answers only for the event's assigned
 * coordinator, so another coordinator's call gets nothing back (#91).
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
}
