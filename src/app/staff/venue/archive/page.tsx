import { getCurrentVenueStaff } from "@/composition/container";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";
import { bookingsForReview } from "../../staff-queues";

export const metadata = { title: "Archive | ConnectSphere" };

export default async function ArchivedBookingsPage() {
  const staff = await getCurrentVenueStaff();
  const archived =
    staff === null ? [] : await bookingsForReview(staff.userAccountId, "archive");

  return (
    <StaffShell role="venue" venueSection="archive" crumbs={[{ label: "Archive" }]}>
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
