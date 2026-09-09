import { decidedBookings } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";

export const metadata = { title: "Decided | ConnectSphere" };

export default function DecidedBookingsPage() {
  const decided = decidedBookings();

  return (
    <StaffShell role="venue" crumbs={[{ label: "Decided" }]}>
      <QueueEmptyState
        title={decided.length === 0 ? "Nothing decided yet" : "Select a booking"}
        description={
          decided.length === 0
            ? "Approved or tentatively held bookings will appear here."
            : "Choose one from the list to review it."
        }
      />
    </StaffShell>
  );
}
