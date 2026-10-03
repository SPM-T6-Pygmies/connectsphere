import { notFound } from "next/navigation";

import {
  buildListVenuesForBooking,
  findAssignedCoordinatorEvent,
  getCurrentCoordinator,
} from "@/composition/container";

import { detailCrumbs } from "../../../../detail-origin";
import { PageHeader, StaffShell } from "../../../../staff-shell";
import { BookVenueForm } from "./book-venue-form";

export const metadata = { title: "Book a venue | ConnectSphere" };

/**
 * SPM-46: the assigned Event Coordinator requests a venue for their event.
 *
 * No venue catalogue browser exists yet (SPM-42/44), so the form carries its
 * own minimal venue+layout picker rather than linking in from one.
 */
export default async function BookVenuePage({
  params,
}: PageProps<"/staff/coordinator/events/[id]/book-venue">) {
  const { id } = await params;

  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    notFound();
  }

  const event = await findAssignedCoordinatorEvent(id, coordinator.userAccountId);
  if (event === null) {
    notFound();
  }

  const listVenuesForBooking = await buildListVenuesForBooking();
  const { venues } = await listVenuesForBooking.execute();

  return (
    <StaffShell
      role="coordinator"
      crumbs={[
        ...detailCrumbs("coordinator", "queue", "My events", event.name, "/staff/coordinator/events"),
        { label: "Book a venue" },
      ]}
      coordinatorSection="events"
    >
      <PageHeader
        title={`Book a venue for ${event.name}`}
        description="Name one venue, the layout it assumes, and the slots you need."
      />
      <BookVenueForm eventId={event.id} venues={venues} />
    </StaffShell>
  );
}
