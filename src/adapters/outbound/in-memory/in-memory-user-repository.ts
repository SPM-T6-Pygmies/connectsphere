import type { UserRepository, UserWithRoles } from "@/core/ports/outbound/user-repository";

export class InMemoryUserRepository implements UserRepository {
  constructor(private readonly usersByAuthUserId: ReadonlyMap<string, UserWithRoles> = new Map()) {}

  async findByAuthUserId(authUserId: string): Promise<UserWithRoles | null> {
    return this.usersByAuthUserId.get(authUserId) ?? null;
  }
}
