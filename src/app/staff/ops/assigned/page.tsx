import { assignedRequests } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";

export const metadata = { title: "Assigned | ConnectSphere" };

export default function AssignedRequestsPage() {
  const assigned = assignedRequests();

  return (
    <StaffShell role="ops" crumbs={[{ label: "Assigned" }]}>
      <QueueEmptyState
        title={assigned.length === 0 ? "Nothing assigned yet" : "Select a request"}
        description={
          assigned.length === 0
            ? "Requests with a coordinator assigned will appear here."
            : "Choose one from the list to reassign or review it."
        }
      />
    </StaffShell>
  );
}
