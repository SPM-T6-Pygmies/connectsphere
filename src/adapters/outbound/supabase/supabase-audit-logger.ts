import { createSupabaseAdminClient } from "@/adapters/outbound/supabase/client";
import type { AuditLogger } from "@/core/ports/outbound/audit-logger";

export class SupabaseAuditLogger implements AuditLogger {
  async logLogout(userId: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    console.log("[SupabaseAuditLogger] Logging logout for userId:", userId);

    const { error } = await supabase
      .from("audit_record")
      .insert({
        actor_user_account_id: parseInt(userId, 10),
        entity_type: "auth_session",
        entity_id: parseInt(userId, 10),
        action: "logout",
      });

    if (error) {
      console.error("[SupabaseAuditLogger] Failed to log logout:", error.message);
      throw new Error(`Audit logging failed: ${error.message}`);
    }

    console.log("[SupabaseAuditLogger] Logout recorded successfully");
  }
}
