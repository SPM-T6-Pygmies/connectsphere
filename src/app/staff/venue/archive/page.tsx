import { archivedBookings } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";

export const metadata = { title: "Archive | ConnectSphere" };

export default function ArchivedBookingsPage() {
  const archived = archivedBookings();

  return (
    <StaffShell role="venue" crumbs={[{ label: "Archive" }]}>
      <QueueEmptyState
        title={archived.length === 0 ? "Nothing archived" : "Select a booking"}
        description={
          archived.length === 0
            ? "Rejected, released or cancelled bookings will appear here."
            : "Choose one from the list to see why it was decided."
        }
      />
    </StaffShell>
  );
}
