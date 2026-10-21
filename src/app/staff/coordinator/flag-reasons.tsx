import { Badge } from "@/components/ui/badge";
import type { FlagReasonCode } from "@/core/domain/booking-review-flag";
import type { EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";

/** What the coordinator reads before the detail. SPM-105 and SPM-309 raise the other two. */
const REASON_LABELS: Readonly<Record<FlagReasonCode, string>> = {
  "venue-unavailable": "Venue unavailable",
  "venue-attributes": "Venue changed",
  "event-change": "Event changed",
};

/** `21 Oct, 9:00 am`, in Singapore. */
export function singaporeMoment(iso: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * SPM-313: the open reasons one booking is flagged for. A reason whose block has since
 * been lifted says so in an amber badge of its own, not in the sentence: a lift never
 * clears the flag, so the coordinator has to be able to see at a glance that the venue is
 * free again and the flag is still there for them to act on (SPM-310, SPM-251).
 */
export function FlagReasons({ flags }: { flags: readonly EventBookingFlag[] }) {
  return (
    <ul className="space-y-3">
      {flags.map((flag) => (
        <li key={flag.flagId} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{REASON_LABELS[flag.reasonCode]}</span>
            {flag.sourceLiftedAt === null ? null : (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                Block lifted · {singaporeMoment(flag.sourceLiftedAt)}
              </Badge>
            )}
          </div>
          <p>{flag.detail}</p>
          {flag.sourceLiftedAt === null ? null : (
            <p className="text-muted-foreground text-xs">
              The venue is free again, but the flag stays until you act on it.
            </p>
          )}
          <p className="text-muted-foreground text-xs">Flagged {singaporeMoment(flag.flaggedAt)}</p>
        </li>
      ))}
    </ul>
  );
}
