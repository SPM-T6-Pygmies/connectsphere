import { createSupabaseAdminClient } from "@/adapters/outbound/supabase/client";

import type { UserRepository, UserWithRoles } from "@/core/ports/outbound/user-repository";

export class SupabaseUserRepository implements UserRepository {
  async findByAuthUserId(authUserId: string): Promise<UserWithRoles | null> {
    const supabase = createSupabaseAdminClient();
    console.log("[SupabaseUserRepository] Finding user by authUserId:", authUserId);

    const { data, error } = await supabase
      .from("user_account")
      .select(
        `
        user_account_id,
        name,
        user_account_role (
          role (
            role_name
          )
        )
      `
      )
      .eq("auth_user_id", authUserId)
      .single();

    console.log("[SupabaseUserRepository] Query result:", {
      found: !!data,
      errorMessage: error?.message
    });

    if (error || !data) {
      console.warn("[SupabaseUserRepository] User not found for authUserId:", authUserId);
      return null;
    }

    const roles = ((data.user_account_role ?? []) as unknown as Array<{ role: { role_name: string } }>).map(
      (uar) => uar.role.role_name
    );

    return {
      userId: data.user_account_id.toString(),
      name: data.name,
      roles,
    };
  }
}
