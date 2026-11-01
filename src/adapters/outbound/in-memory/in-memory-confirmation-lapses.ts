import type { LapseCause } from "@/core/domain/event-readiness";
import type { UserAccountId } from "@/core/domain/user-account";
import type { ConfirmationLapses, EventConfirmationLapse } from "@/core/ports/outbound/confirmation-lapses";

/**
 * Lapses are seeded per cause and source, standing in for what
 * `lapse_event_confirmation` would have recorded. Who may read them is not
 * modelled: the use cases have already checked the caller.
 */
export class InMemoryConfirmationLapses implements ConfirmationLapses {
  private readonly lapses = new Map<string, readonly EventConfirmationLapse[]>();

  record(cause: LapseCause, sourceRef: string, lapses: readonly EventConfirmationLapse[]): void {
    this.lapses.set(`${cause}:${sourceRef}`, lapses);
  }

  async causedBy(
    _reader: UserAccountId,
    cause: LapseCause,
    sourceRef: string,
  ): Promise<readonly EventConfirmationLapse[]> {
    return this.lapses.get(`${cause}:${sourceRef}`) ?? [];
  }
}
