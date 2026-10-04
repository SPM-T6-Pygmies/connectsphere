import { buildReviewBookingRequests, getCurrentVenueStaff } from "@/composition/container";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";

export const metadata = { title: "Archive | ConnectSphere" };

export default async function ArchivedBookingsPage() {
  const staff = await getCurrentVenueStaff();
  const reviewBookingRequests = await buildReviewBookingRequests();
  const archived =
    staff === null ? [] : await reviewBookingRequests.list(staff.userAccountId, "archive");

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
