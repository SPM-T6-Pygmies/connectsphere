import { SLOT_HOURS, type BookingSlot } from "@/core/domain/booking";
import type { TimeRangeOnDate } from "@/core/domain/event-times";
import { paddedWindows } from "@/core/domain/padded-window";
import { bufferMinutes, type VenueBuffers } from "@/core/domain/venue-buffers";

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

/**
 * SPM-19: the time a booking really takes from its venue, setup and turnaround included, with
 * the two values, e.g. "room in use 2026-12-14 09:30–12:45 (setup 30 min, turnaround 45 min)".
 * Null when the venue adds nothing (none set, or 0 and 0), so there is nothing more to say.
 */
export function formatOccupied(
  times: readonly TimeRangeOnDate[],
  venue: Partial<VenueBuffers> | null,
): string | null {
  const { setup, turnaround } = bufferMinutes(venue ?? {});
  if (setup === 0 && turnaround === 0) return null;
  const windows = times.flatMap((time) => paddedWindows(time, { setup, turnaround }));
  return `room in use ${formatTimes(windows)} (setup ${setup} min, turnaround ${turnaround} min)`;
}

/** The slot codes as a list, or a dash when there are none. */
export function formatSlots(slots: readonly BookingSlot[]): string {
  return slots.length === 0 ? "—" : slots.join(", ");
}
