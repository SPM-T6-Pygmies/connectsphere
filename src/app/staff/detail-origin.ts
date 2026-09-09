import type { StaffRole } from "@/lib/wireframe";

import type { Crumb } from "./staff-shell";

/**
 * Where a detail screen was opened from.
 *
 * The same body renders under the record's own route and under the inbox, and
 * the only thing that differs is the trail back -- so the two callers pass
 * this rather than each assembling its own crumbs.
 */
export type DetailOrigin = "queue" | "inbox";

export function detailCrumbs(
  role: StaffRole,
  origin: DetailOrigin,
  queueLabel: string,
  title: string,
): Crumb[] {
  return origin === "inbox"
    ? [
        { label: "Notifications", href: `/staff/${role}/notifications` },
        { label: title },
      ]
    : [{ label: queueLabel, href: `/staff/${role}` }, { label: title }];
}
