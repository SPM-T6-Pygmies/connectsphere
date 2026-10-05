import { ShieldCheckIcon } from "lucide-react";

import { QueueEmptyState } from "../queue-empty-state";
import { StaffShell } from "../staff-shell";

export const metadata = { title: "Awaiting check | ConnectSphere" };

/**
 * The Safety Officer's workspace (SPM-258). `StaffShell` refuses anyone who
 * is not a Safety Officer with the shared access-denied screen (SPM-16).
 *
 * The list of events awaiting a check is SPM-259's; until it lands there is
 * nothing to open here.
 */
export default function SafetyPage() {
  return (
    <StaffShell role="safety" crumbs={[{ label: "Awaiting check" }]}>
      <QueueEmptyState
        icon={ShieldCheckIcon}
        title="No events awaiting a safety check"
        description="Events appear here once their venue and equipment are confirmed."
      />
    </StaffShell>
  );
}
