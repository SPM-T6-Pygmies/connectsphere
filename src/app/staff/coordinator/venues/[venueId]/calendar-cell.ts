import type { Badge } from "@/components/ui/badge";
import type { CalendarPeriod, CalendarPeriodStatus } from "@/core/domain/venue-calendar";

import { formatHoldExpiry } from "../../../hold-expiry";

type Variant = React.ComponentProps<typeof Badge>["variant"];

/** What one calendar period reads as: a status badge, and a line under it when there is more to say. */
export interface CalendarCellView {
  readonly label: string;
  readonly variant: Variant;
  readonly detail: string | null;
}

/** Green is free to request; amber and red are taken; grey is never bookable. */
const STATUS: Record<CalendarPeriodStatus, { label: string; variant: Variant }> = {
  available: { label: "Available", variant: "success" },
  confirmed: { label: "Confirmed", variant: "secondary" },
  held: { label: "Held", variant: "warning" },
  blocked: { label: "Blocked", variant: "destructive" },
  closed: { label: "Closed", variant: "outline" },
};

// Calendar days are plain `YYYY-MM-DD`; read them at UTC midnight so the day never shifts.
const dayHeadingFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** SPM-155: how a period reads on the calendar. A blocked period gives its reasons (SPM-323 AC3). */
export function calendarCell(period: CalendarPeriod): CalendarCellView {
  let detail: string | null = null;
  if (period.status === "held" && period.holdExpiresAt !== null) {
    detail = `Until ${formatHoldExpiry(period.holdExpiresAt.toISOString())}`;
  } else if (period.status === "blocked" && period.reasons.length > 0) {
    // Only Other carries a note, so the notes read as part of it.
    detail = period.reasons
      .map((reason) => (reason === "Other" && period.notes.length > 0 ? `Other: ${period.notes.join("; ")}` : reason))
      .join(", ");
  }
  return { ...STATUS[period.status], detail };
}

/** SPM-323: a period's row heading, its own times, e.g. "10:15–10:30". Never AM, PM or Night (AC5). */
export function periodLabel({ start, end }: Pick<CalendarPeriod, "start" | "end">): string {
  return `${start}–${end}`;
}

/** A calendar day's column heading, e.g. "Mon, 2 Nov". */
export function dayHeading(date: string): string {
  return dayHeadingFormat.format(new Date(`${date}T00:00:00.000Z`));
}
