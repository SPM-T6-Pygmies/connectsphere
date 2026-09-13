import type { UserAccount } from "../../domain/user-account";

/** Read-side access to every account holding the Event Coordinator role. */
export interface EventCoordinatorDirectory {
  listAll(): Promise<readonly UserAccount[]>;
}
