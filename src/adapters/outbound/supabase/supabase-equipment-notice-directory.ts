import type { EventId } from "@/core/domain/event";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type { EquipmentNoticeDirectory } from "@/core/ports/outbound/equipment-notice-directory";

import type { SupabaseAdminClient } from "./client";

/**
 * SPM-64 and SPM-65, through the service-role-only functions in
 * 20261019000100_equipment_notice_recipients.sql: neither the coordinator nor
 * Technical Support may read these themselves.
 */
export class SupabaseEquipmentNoticeDirectory implements EquipmentNoticeDirectory {
  constructor(private readonly client: SupabaseAdminClient) {}

  async technicalSupportStaff(): Promise<readonly UserAccountId[]> {
    const { data, error } = await this.client.rpc("technical_support_staff_ids");
    if (error) {
      throw new Error(`Failed to read the Technical Support Staff: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as { user_account_id: number }[]).map((row) =>
      userAccountId(String(row.user_account_id)),
    );
  }

  async assignedCoordinator(eventId: EventId): Promise<UserAccountId | null> {
    const { data, error } = await this.client.rpc("event_assigned_coordinator_id", {
      p_event_id: Number(eventId),
    });
    if (error) {
      throw new Error(`Failed to read event ${eventId}'s coordinator: ${error.message}`, { cause: error });
    }
    return data === null || data === undefined ? null : userAccountId(String(data));
  }
}
