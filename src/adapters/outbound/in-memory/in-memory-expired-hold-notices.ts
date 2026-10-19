import type { ExpiredHold, ExpiredHoldNotices } from "@/core/ports/outbound/expired-hold-notices";

/** Seeded with expired holds that have not been announced yet. A claim hands them over once. */
export class InMemoryExpiredHoldNotices implements ExpiredHoldNotices {
  private unclaimed: readonly ExpiredHold[];

  constructor(seed: readonly ExpiredHold[] = []) {
    this.unclaimed = seed;
  }

  async claim(): Promise<readonly ExpiredHold[]> {
    const claimed = this.unclaimed;
    this.unclaimed = [];
    return claimed;
  }
}
