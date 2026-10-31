import { getCurrentVenueStaff } from "@/composition/container";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";
import { bookingsForReview } from "../../staff-queues";

export const metadata = { title: "Decided | ConnectSphere" };

export default async function DecidedBookingsPage() {
  const staff = await getCurrentVenueStaff();
  const decided =
    staff === null ? [] : await bookingsForReview(staff.userAccountId, "decided");

  return (
    <StaffShell role="venue" venueSection="decided" crumbs={[{ label: "Decided" }]}>
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
