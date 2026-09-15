import type { SupabaseAdminClient } from "@/adapters/outbound/supabase/client";

import type { UserRepository, UserWithRoles } from "@/core/ports/outbound/user-repository";

export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly supabase: SupabaseAdminClient) {}

  async findByAuthUserId(authUserId: string): Promise<UserWithRoles | null> {
    const { supabase } = this;
    console.log("[SupabaseUserRepository] Finding user by authUserId:", authUserId);

    const { data, error } = await supabase
      .from("user_account")
      .select(
        `
        user_account_id,
        name,
        client_organisation_id,
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
      clientOrganisationId:
        data.client_organisation_id === null ? null : data.client_organisation_id.toString(),
    };
  }
}
