import { bookingsAwaitingDecision } from "@/lib/wireframe";

import { QueueEmptyState } from "../queue-empty-state";
import { StaffShell } from "../staff-shell";

export const metadata = { title: "Requests | ConnectSphere" };

export default function VenuePage() {
  const requests = bookingsAwaitingDecision();

  return (
    <StaffShell role="venue" crumbs={[{ label: "Requests" }]}>
      <QueueEmptyState
        title={requests.length === 0 ? "No booking requests" : "Select a request"}
        description={
          requests.length === 0
            ? "Requests to decide will appear here."
            : "Choose one from the list to decide it."
        }
      />
    </StaffShell>
  );
}
