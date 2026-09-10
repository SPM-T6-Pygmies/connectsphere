import { createClient } from "@/src/lib/supabase/server";
import type { UserRepository, UserWithRoles } from "@/src/core/ports/outbound/user-repository";

export class SupabaseUserRepository implements UserRepository {
  async findByAuthUserId(authUserId: string): Promise<UserWithRoles | null> {
    const supabase = await createClient();

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

    if (error || !data) {
      return null;
    }

    const roles = (data.user_account_role as Array<{ role: { role_name: string } }>).map(
      (uar) => uar.role.role_name
    );

    return {
      userId: data.user_account_id.toString(),
      name: data.name,
      roles,
    };
  }
}
