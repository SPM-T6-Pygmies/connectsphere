import type { UserAccount, UserAccountId } from "../../domain/user-account";

/** Read-side access to every account holding the Event Coordinator role. */
export interface EventCoordinatorDirectory {
  listAll(): Promise<readonly UserAccount[]>;
  exists(id: UserAccountId): Promise<boolean>;
}
