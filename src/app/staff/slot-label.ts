import { SLOT_HOURS, type BookingSlot } from "@/core/domain/booking";
import type { TimeRangeOnDate } from "@/core/domain/event-times";
import { paddedWindows } from "@/core/domain/padded-window";
import { bufferMinutes, describeBuffers, type VenueBuffers } from "@/core/domain/venue-buffers";

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
 * SPM-19: the time a booking really takes from its venue, setup and turnaround included, e.g.
 * `{ inUse: "2026-12-14 09:30–12:45", setup: 30, turnaround: 45 }`. Null when the venue adds
 * nothing (none set, or 0 and 0), so there is nothing more to say.
 */
export function roomInUse(
  times: readonly TimeRangeOnDate[],
  venue: Partial<VenueBuffers> | null,
): { readonly inUse: string; readonly setup: number; readonly turnaround: number } | null {
  const { setup, turnaround } = bufferMinutes(venue ?? {});
  if (setup === 0 && turnaround === 0) return null;
  const windows = times.flatMap((time) => paddedWindows(time, { setup, turnaround }));
  return { inUse: formatTimes(windows), setup, turnaround };
}

/**
 * SPM-19: the note beside a venue's name on Venue Staff's booking pages and lists: its setup and
 * turnaround, or plainly that none are set. Null when the venue is no longer in the catalogue.
 */
export function venueBufferNote(venue: Partial<VenueBuffers> | null): string | null {
  if (venue === null) return null;
  const described = describeBuffers(venue);
  return described === "Not set" ? "No setup or turnaround set" : described;
}

/** The slot codes as a list, or a dash when there are none. */
export function formatSlots(slots: readonly BookingSlot[]): string {
  return slots.length === 0 ? "—" : slots.join(", ");
}
