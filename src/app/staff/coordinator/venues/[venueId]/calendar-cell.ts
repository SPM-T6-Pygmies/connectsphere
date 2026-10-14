import type { Badge } from "@/components/ui/badge";
import type { CalendarSlot, CalendarSlotStatus } from "@/core/domain/venue-calendar";

type Variant = React.ComponentProps<typeof Badge>["variant"];

/** What one calendar slot reads as: a status badge, and a line under it when there is more to say. */
export interface CalendarCellView {
  readonly label: string;
  readonly variant: Variant;
  readonly detail: string | null;
}

/** Green is free to request; amber and red are taken; grey is never bookable. */
const STATUS: Record<CalendarSlotStatus, { label: string; variant: Variant }> = {
  available: { label: "Available", variant: "success" },
  booked: { label: "Confirmed", variant: "secondary" },
  held: { label: "Held", variant: "warning" },
  blocked: { label: "Blocked", variant: "destructive" },
  notOffered: { label: "Not offered", variant: "outline" },
};

const holdExpiryFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

// Calendar days are plain `YYYY-MM-DD`; read them at UTC midnight so the day never shifts.
const dayHeadingFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** SPM-155: how a slot reads on the calendar. A blocked slot gives its reasons (SPM-43 AC2). */
export function calendarCell(slot: CalendarSlot): CalendarCellView {
  let detail: string | null = null;
  if (slot.status === "held" && slot.holdExpiresAt !== null) {
    detail = `Until ${holdExpiryFormat.format(slot.holdExpiresAt)}`;
  } else if (slot.status === "blocked" && slot.reasons.length > 0) {
    detail = slot.reasons.join(", ");
  }
  return { ...STATUS[slot.status], detail };
}

/** A calendar day's column heading, e.g. "Mon, 2 Nov". */
export function dayHeading(date: string): string {
  return dayHeadingFormat.format(new Date(`${date}T00:00:00.000Z`));
}
