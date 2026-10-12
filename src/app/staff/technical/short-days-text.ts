import type { ShortDays } from "@/core/domain/equipment-review";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** `2026-11-20` as `20 Nov`. */
function day(isoDate: string): string {
  return DAY.format(new Date(`${isoDate}T00:00:00Z`));
}

/** `20 Nov`, `19–20 Nov`, or `30 Nov – 1 Dec`. */
function dayRange(from: string, to: string): string {
  if (from === to) {
    return day(from);
  }
  const [fromDay, fromMonth] = day(from).split(" ");
  const [toDay, toMonth] = day(to).split(" ");
  return fromMonth === toMonth ? `${fromDay}–${toDay} ${toMonth}` : `${day(from)} – ${day(to)}`;
}

/**
 * SPM-274 AC7: one line of the Equipment card's warning, e.g. "20 Nov (8
 * reserved but only 7 in service): Design Sprint Demo (20 Nov) has 6
 * reserved, Sales Kickoff (21 Nov) has 2 reserved".
 */
export function shortDaysText(run: ShortDays, inService: number): string {
  const events = run.events
    .map((event) => `${event.eventName} (${day(event.eventDate)}) has ${event.quantityReserved} reserved`)
    .join(", ");
  return `${dayRange(run.from, run.to)} (${run.reserved} reserved but only ${inService} in service): ${events}`;
}
