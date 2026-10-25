import { forbidden, redirect } from "next/navigation";

import { buildFindAssignedEventByRequest, getCurrentCoordinator } from "@/composition/container";

/**
 * SPM-459: the old Request a venue page, keyed by the approved request. Venue
 * booking now lives in the event page's Venue tab, so this sends a link still
 * keyed by the request -- a notification sent before the move -- there,
 * keeping the booking (`?booking=`) or suggested venue (`?venue=`) it opened.
 *
 * Someone else's request gets the same access-denied screen as one that does
 * not exist (SPM-16, #91), as the page did.
 */
export default async function VenueBookingRedirect({
  params,
  searchParams,
}: PageProps<"/staff/coordinator/[id]/venue-booking">) {
  const { id } = await params;
  const { booking, venue } = await searchParams;

  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    forbidden();
  }

  const findAssignedEventByRequest = await buildFindAssignedEventByRequest();
  const eventId = await findAssignedEventByRequest.execute({ eventRequestId: id, ...coordinator });
  if (eventId === null) {
    forbidden();
  }

  const query = new URLSearchParams({ tab: "venue" });
  if (typeof booking === "string") {
    query.set("booking", booking);
  }
  if (typeof venue === "string") {
    query.set("venue", venue);
  }
  redirect(
    `/staff/coordinator/events/${eventId}?${query}${typeof venue === "string" ? "#new-request" : ""}`,
  );
}
