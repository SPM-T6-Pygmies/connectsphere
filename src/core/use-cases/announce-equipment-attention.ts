import type { EquipmentRequirement } from "../domain/equipment-requirement";
import { newlyNeedsAttention } from "../domain/equipment-review";
import type { EquipmentNoticeDirectory } from "../ports/outbound/equipment-notice-directory";
import type { Notifier } from "../ports/outbound/notifier";

/** One coordinator change to one line: the line as it was and as it is now. */
export interface EquipmentLineChange {
  readonly event: {
    readonly id: string;
    readonly name: string;
    /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
    readonly preferredDate: string | null;
  };
  readonly equipmentType: string;
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
 * SPM-64: tells every Technical Support Staff member when a coordinator's
 * change puts a line in front of them anew. Which changes do is the domain's
 * call (`newlyNeedsAttention`); every use case that can add, change or remove
 * a line hands it here, as it was and as it is, once the change is stored.
 * Undoing a removal request never qualifies, so it does not.
 */
export class EquipmentAttentionAnnouncer {
  constructor(private readonly deps: EquipmentAttentionAnnouncerDeps) {}

  async announce(change: EquipmentLineChange): Promise<void> {
    const reason = newlyNeedsAttention(change.before, change.after);
    if (reason === null || change.after === null) {
      return;
    }
    const { event, equipmentType, after } = change;
    for (const member of await this.deps.directory.technicalSupportStaff()) {
      await this.deps.notifier.equipmentNeedsAttention({
        recipientUserAccountId: member,
        eventId: event.id,
        eventName: event.name,
        preferredDate: event.preferredDate,
        equipmentType,
        quantityRequested: after.quantityRequested,
        reason,
        quantityWas: reason === "changed" ? (after.reviewBaseline?.quantityRequested ?? null) : null,
      });
    }
  }
}
