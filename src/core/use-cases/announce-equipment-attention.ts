import type { EquipmentRequirement } from "../domain/equipment-requirement";
import { attentionReason } from "../domain/equipment-review";
import type { EquipmentNoticeDirectory } from "../ports/outbound/equipment-notice-directory";
import type { EquipmentNeedsAttentionNotice, Notifier } from "../ports/outbound/notifier";

/** One coordinator change to one line: what they did, and the line as it was and as it is now. */
export interface EquipmentLineChange {
  readonly event: {
    readonly id: string;
    readonly name: string;
    /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
    readonly preferredDate: string | null;
  };
  readonly equipmentType: string;
  readonly change: EquipmentNeedsAttentionNotice["change"];
  /** Null for a line just added. */
  readonly before: EquipmentRequirement | null;
  /** Null for a line just deleted. */
  readonly after: EquipmentRequirement | null;
}

export interface EquipmentAttentionAnnouncerDeps {
  readonly directory: Pick<EquipmentNoticeDirectory, "technicalSupportStaff">;
  readonly notifier: Notifier;
}

/**
 * SPM-64: tells every Technical Support Staff member of each change a
 * coordinator stores to a line -- adding, editing, deleting, asking to remove
 * or taking that back (AC1) -- and whether it leaves anything for them to do
 * (AC2). Every use case that can change a line hands it here, as it was and
 * as it is, once the change is stored; a refused change never gets here (AC3).
 */
export class EquipmentAttentionAnnouncer {
  constructor(private readonly deps: EquipmentAttentionAnnouncerDeps) {}

  async announce({ event, equipmentType, change, before, after }: EquipmentLineChange): Promise<void> {
    const line = after ?? before;
    if (line === null) {
      return;
    }
    const quantityWas =
      change === "edited" && before !== null && before.quantityRequested !== line.quantityRequested
        ? before.quantityRequested
        : null;
    for (const member of await this.deps.directory.technicalSupportStaff()) {
      await this.deps.notifier.equipmentNeedsAttention({
        recipientUserAccountId: member,
        eventId: event.id,
        eventName: event.name,
        preferredDate: event.preferredDate,
        equipmentType,
        change,
        quantityRequested: line.quantityRequested,
        quantityWas,
        attention: after === null ? null : attentionReason(after),
      });
    }
  }
}
