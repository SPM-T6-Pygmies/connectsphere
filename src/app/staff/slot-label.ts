import { SLOT_HOURS, type BookingSlot, type SlotOnDate } from "@/core/domain/booking";

import { formatTimeOnly } from "./time-picker";

/** A slot with the hours it covers, e.g. "AM (7:00 AM – 12:00 PM)". */
export function slotLabel(slot: BookingSlot): string {
  const { start, end } = SLOT_HOURS[slot];
  return `${slot} (${formatTimeOnly(start)} – ${formatTimeOnly(end)})`;
}

/** The slot codes as a list, or a dash when there are none. */
export function formatSlots(slots: readonly BookingSlot[]): string {
  return slots.length === 0 ? "—" : slots.join(", ");
}

/** Slots across days, e.g. "2026-11-04 AM, 2026-11-04 PM", or null when there are none. */
export function formatSlotsOnDates(slots: readonly SlotOnDate[]): string | null {
  return slots.length === 0 ? null : slots.map(({ date, slot }) => `${date} ${slot}`).join(", ");
}
