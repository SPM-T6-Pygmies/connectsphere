import { notFound } from "next/navigation";

import { actingCoordinator, buildViewAssignedEventRequest } from "@/composition/container";

import type { DetailOrigin } from "../detail-origin";
import { AssignedRequestDetail } from "./assigned-request-detail";

/**
 * SPM-32: the read-only view of one event request assigned to the caller as
 * coordinator, whatever its status. Approving/rejecting/returning (SPM-34)
 * and the tabbed workspace an *Approved* request eventually becomes (a
 * separate, backlog-scoped "My events" view) are both out of scope here --
 * this renders the same submitted fields regardless of status.
 *
 * One entry point for both the record's own route and the notification-detail
 * lookup, so neither can drift and show the wrong shape for the same request.
 */
export async function CoordinatorDetail({
  id,
  origin = "queue",
}: {
  id: string;
  origin?: DetailOrigin;
  tab?: string | string[];
  activity?: string | string[];
  basePath?: string;
}) {
  const coordinator = actingCoordinator();
  const viewAssignedEventRequest = await buildViewAssignedEventRequest();
  const result = await viewAssignedEventRequest.execute({ id, ...coordinator });

  if (result === null) {
    notFound();
  }

  return (
    <AssignedRequestDetail
      eventRequest={result.eventRequest}
      requestingOrganiserName={result.requestingOrganiserName}
      clientOrganisationName={result.clientOrganisationName}
      origin={origin}
    />
  );
}
