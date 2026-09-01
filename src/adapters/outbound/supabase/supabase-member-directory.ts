import type { MemberId } from "@/core/domain/member";
import type { MemberDirectory } from "@/core/ports/outbound/member-directory";

import type { SupabaseServerClient } from "./client";

export class SupabaseMemberDirectory implements MemberDirectory {
  constructor(private readonly client: SupabaseServerClient) {}

  async exists(id: MemberId): Promise<boolean> {
    const { count, error } = await this.client
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to look up member: ${error.message}`, { cause: error });
    }

    return (count ?? 0) > 0;
  }
}
