import { buildReviewBookingRequests, getCurrentVenueStaff } from "@/composition/container";

import { QueueEmptyState } from "../queue-empty-state";
import { StaffShell } from "../staff-shell";

export const metadata = { title: "Requests | ConnectSphere" };

/** SPM-22: the booking requests waiting for Venue Staff to decide. */
export default async function VenuePage() {
  const staff = await getCurrentVenueStaff();
  const reviewBookingRequests = await buildReviewBookingRequests();
  const requests =
    staff === null ? [] : await reviewBookingRequests.list(staff.userAccountId, "requests");

  return (
    <StaffShell role="venue" venueSection="requests" crumbs={[{ label: "Requests" }]}>
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
