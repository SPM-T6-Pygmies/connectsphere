import type { EventId } from "@/core/domain/event";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type { EquipmentNoticeDirectory } from "@/core/ports/outbound/equipment-notice-directory";

export class InMemoryEquipmentNoticeDirectory implements EquipmentNoticeDirectory {
  private readonly staff: readonly UserAccountId[];
  private readonly coordinators: ReadonlyMap<string, UserAccountId>;

  /** `coordinators` maps an event id to its assigned coordinator; an event left out has none. */
  constructor(staff: readonly string[] = [], coordinators: Readonly<Record<string, string>> = {}) {
    this.staff = staff.map(userAccountId);
    this.coordinators = new Map(Object.entries(coordinators).map(([event, id]) => [event, userAccountId(id)]));
  }

  async technicalSupportStaff(): Promise<readonly UserAccountId[]> {
    return this.staff;
  }

  async assignedCoordinator(eventId: EventId): Promise<UserAccountId | null> {
    return this.coordinators.get(eventId) ?? null;
  }
}
