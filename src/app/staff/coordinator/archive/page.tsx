import { archivedCoordinatorRequests } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";

export const metadata = { title: "Archive | ConnectSphere" };

export default function CoordinatorArchivePage() {
  const archived = archivedCoordinatorRequests();

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "Archive" }]}>
      <QueueEmptyState
        title={archived.length === 0 ? "Nothing archived" : "Select a request"}
        description={
          archived.length === 0
            ? "Rejected, returned or withdrawn requests will appear here."
            : "Choose one from the list to see why it was decided."
        }
      />
    </StaffShell>
  );
}
