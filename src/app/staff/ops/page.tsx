import { awaitingAssignment } from "@/lib/wireframe";

import { QueueEmptyState } from "../queue-empty-state";
import { StaffShell } from "../staff-shell";

export const metadata = { title: "Unassigned | ConnectSphere" };

export default function OpsPage() {
  const unassigned = awaitingAssignment();

  return (
    <StaffShell role="ops" crumbs={[{ label: "Unassigned" }]}>
      <QueueEmptyState
        title={unassigned.length === 0 ? "Nothing awaiting assignment" : "Select a request"}
        description={
          unassigned.length === 0
            ? "Submitted requests without a coordinator will appear here."
            : "Choose one from the list to assign a coordinator."
        }
      />
    </StaffShell>
  );
}
