import { notFound } from "next/navigation";

import { eventById } from "@/lib/wireframe";

import type { DetailOrigin } from "../detail-origin";
import { EventDetail } from "./event-detail";
import { RequestReviewDetail } from "./request-review-detail";

/**
 * Which screen a coordinator's event lands on, keyed off the request status
 * alone: the tabbed event shell only makes sense once planning has actually
 * started (Approved); anything still pending or resolved without approval
 * gets the tab-less review screen instead. One entry point for both the
 * record's own route and the notification-detail lookup, so neither can
 * drift and show the wrong shape for the same event.
 */
export function CoordinatorDetail({
  id,
  origin = "queue",
  tab,
  activity,
  basePath,
}: {
  id: string;
  origin?: DetailOrigin;
  tab?: string | string[];
  activity?: string | string[];
  basePath?: string;
}) {
  const event = eventById(id);

  if (!event) {
    notFound();
  }

  const status = event.request.status;

  if (status === "Approved") {
    return (
      <EventDetail id={id} tab={tab} activity={activity} basePath={basePath} origin={origin} />
    );
  }

  if (status === "Submitted" || status === "Under Review") {
    return <RequestReviewDetail id={id} origin={origin} />;
  }

  // Rejected | Returned | Withdrawn (Draft is unreachable here: a coordinator
  // is never assigned to a request before it's submitted).
  return <RequestReviewDetail id={id} origin={origin} readOnly />;
}
