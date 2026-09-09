import { pendingCoordinatorRequests } from "@/lib/wireframe";

import { QueueEmptyState } from "../queue-empty-state";
import { StaffShell } from "../staff-shell";

export const metadata = { title: "My requests | ConnectSphere" };

export default function CoordinatorPage() {
  const pending = pendingCoordinatorRequests();

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "My requests" }]}>
      <QueueEmptyState
        title={pending.length === 0 ? "No requests awaiting review" : "Select a request"}
        description={
          pending.length === 0
            ? "Requests operations assigns to you will appear here."
            : "Choose one from the list to review what was submitted."
        }
      />
    </StaffShell>
  );
}
