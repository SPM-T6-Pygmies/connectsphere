import type { UserAccountId } from "@/core/domain/user-account";
import type { UserAccountRepository } from "@/core/ports/outbound/user-account-repository";

export class InMemoryUserAccountRepository implements UserAccountRepository {
  private readonly names: ReadonlyMap<UserAccountId, string>;

  constructor(seed: ReadonlyMap<UserAccountId, string> = new Map()) {
    this.names = seed;
  }

  async findNamesByIds(ids: readonly UserAccountId[]): Promise<ReadonlyMap<UserAccountId, string>> {
    const result = new Map<UserAccountId, string>();
    for (const id of ids) {
      const name = this.names.get(id);
      if (name !== undefined) {
        result.set(id, name);
      }
    }
    return result;
  }
}
