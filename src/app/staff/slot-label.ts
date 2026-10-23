import { SLOT_HOURS, type BookingSlot } from "@/core/domain/booking";
import type { TimeRangeOnDate } from "@/core/domain/event-times";

import { formatTimeOnly } from "./time-picker";

/** A slot with the hours it covers, e.g. "AM (7:00 AM – 12:00 PM)". */
export function slotLabel(slot: BookingSlot): string {
  const { start, end } = SLOT_HOURS[slot];
  return `${slot} (${formatTimeOnly(start)} – ${formatTimeOnly(end)})`;
}

/** Each date with its start and end time, e.g. "2026-11-04 07:00–12:00" (SPM-324), or a dash. */
export function formatTimes(times: readonly TimeRangeOnDate[]): string {
  return times.length === 0 ? "—" : times.map(({ date, start, end }) => `${date} ${start}–${end}`).join(", ");
}

/** The slot codes as a list, or a dash when there are none. */
export function formatSlots(slots: readonly BookingSlot[]): string {
  return slots.length === 0 ? "—" : slots.join(", ");
}
