import { approvedCoordinatorEvents } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";

export const metadata = { title: "My events | ConnectSphere" };

export default function CoordinatorEventsPage() {
  const events = approvedCoordinatorEvents();

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "My events" }]}>
      <QueueEmptyState
        title={events.length === 0 ? "No events yet" : "Select an event"}
        description={
          events.length === 0
            ? "Approved requests you are planning will appear here."
            : "Choose one from the list to see its full detail."
        }
      />
    </StaffShell>
  );
}
