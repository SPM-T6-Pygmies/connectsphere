import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import { NotCoordinatorLeadError } from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type { LeadEventRepository } from "@/core/ports/outbound/lead-event-repository";

import type { SupabaseServerClient } from "./client";
import { toCoordinatorEvent, toKey, type CoordinatorEventRecordRow } from "./coordinator-event-mapper";
import { toLeadEventError } from "./lead-event-mapper";

/**
 * SPM-256, through `lead_events`, not the table -- the table's own grant and
 * policy are scoped to the Attendee's read. The function re-checks that the
 * reader is an Event Coordinator Lead and answers CS060 if not, which comes
 * back as the domain's own error.
 */
export class SupabaseLeadEventRepository implements LeadEventRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listAll(reader: UserAccountId): Promise<readonly CoordinatorEvent[]> {
    const key = toKey(reader);
    if (key === null) {
      // An id this store could never have issued is not a Lead.
      throw new NotCoordinatorLeadError();
    }

    const { data, error } = await this.client.rpc("lead_events", { p_user_account_id: key });

    if (error) {
      throw (
        toLeadEventError(error) ??
        new Error(`Failed to read every event: ${error.message}`, { cause: error })
      );
    }

    return ((data ?? []) as unknown as CoordinatorEventRecordRow[]).map(toCoordinatorEvent);
  }
}
