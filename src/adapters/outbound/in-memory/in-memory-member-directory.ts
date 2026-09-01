import type { MemberId } from "@/core/domain/member";
import type { MemberDirectory } from "@/core/ports/outbound/member-directory";

export class InMemoryMemberDirectory implements MemberDirectory {
  private readonly ids: ReadonlySet<string>;

  constructor(ids: readonly string[]) {
    this.ids = new Set(ids);
  }

  async exists(id: MemberId): Promise<boolean> {
    return this.ids.has(id);
  }
}
