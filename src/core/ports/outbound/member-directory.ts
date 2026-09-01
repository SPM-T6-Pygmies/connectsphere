import type { MemberId } from "../../domain/member";

/** Driven port: read-side lookup of members owned by another part of the system. */
export interface MemberDirectory {
  exists(id: MemberId): Promise<boolean>;
}
