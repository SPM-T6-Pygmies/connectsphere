import { CircleCheck, CircleHelp, CircleX } from "lucide-react";

import type {
  SuitabilityCheck,
  SuitabilityStatus,
  VenueSuitability,
} from "@/core/domain/venue-suitability";

const LABEL: Record<SuitabilityCheck, string> = {
  layout: "Layout",
  capacity: "Capacity",
  accessibility: "Accessibility",
  facilities: "Facilities",
};

const STATUS: Record<SuitabilityStatus, { icon: typeof CircleCheck; className: string; sr: string }> = {
  pass: { icon: CircleCheck, className: "text-emerald-600", sr: "Fits" },
  fail: { icon: CircleX, className: "text-destructive", sr: "Does not fit" },
  unknown: { icon: CircleHelp, className: "text-muted-foreground", sr: "Not known" },
};

/**
 * SPM-45: a venue's suitability for the event, in the Coordinator's words.
 * Presentation only -- every verdict is `checkVenueSuitability`'s, worked out
 * on the server. It advises and never blocks (AC3); whether over capacity
 * should block is still open (SPM-107).
 *
 * `compact` is for a table cell: the overall verdict, then only the rows that
 * did not pass, which are the reasons (AC8).
 */
export function SuitabilityChecklist({
  suitability,
  compact = false,
  label = "Suitability checklist",
}: {
  suitability: VenueSuitability;
  compact?: boolean;
  label?: string;
}) {
  const overall =
    suitability.overall === "Not suitable"
      ? `Not suitable: ${suitability.failing.map((check) => LABEL[check].toLowerCase()).join(", ")}`
      : suitability.overall;
  const overallClass =
    suitability.overall === "Suitable"
      ? "text-emerald-700 dark:text-emerald-500"
      : suitability.overall === "Not suitable"
        ? "text-destructive"
        : "text-muted-foreground";

  const rows = compact ? suitability.rows.filter((row) => row.status !== "pass") : suitability.rows;

  return (
    <div role="group" aria-label={label} className={compact ? "space-y-1" : "space-y-2 rounded-lg border p-3"}>
      <p className={`${compact ? "text-xs" : "text-sm"} font-medium ${overallClass}`}>{overall}</p>
      <ul className={compact ? "space-y-0.5" : "space-y-1.5"}>
        {rows.map((row) => {
          const { icon: Icon, className, sr } = STATUS[row.status];
          return (
            <li key={row.check} className="flex items-start gap-2 text-xs">
              <Icon aria-hidden className={`mt-0.5 size-3.5 shrink-0 ${className}`} />
              <span>
                <span className="sr-only">{sr}: </span>
                <span className="font-medium">{LABEL[row.check]}</span>
                <span className="text-muted-foreground"> · {row.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
