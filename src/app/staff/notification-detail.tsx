import { redirect } from "next/navigation";

import type { StaffRole } from "@/lib/wireframe";

import { CoordinatorDetail } from "./coordinator/coordinator-detail";
import { LoadedAssignDetail } from "./ops/assign-detail";
import { ReservationDetail } from "./technical/reservation-detail";
import { BookingDetail } from "./venue/booking-detail";

/**
 * A record opened from the inbox.
 *
 * Renders the record a notification points at, in the same component its own
 * route uses -- a notification points at something rather than restating it,
 * so there is nothing here to render on its own. `recordId` is the id from
 * the notification's redirect; see `notificationItem`.
 *
 * The route sits under /notifications, which is the whole point: the sidebar
 * reads its section from the path, so the inbox list stays open beside this
 * and the next notification is one click away. The record's own component
 * still decides who may see it.
 */
export function NotificationDetail({
  role,
  recordId,
}: {
  role: StaffRole;
  recordId: string;
  tab?: string | string[];
  activity?: string | string[];
}) {
  switch (role) {
    case "coordinator":
      return <CoordinatorDetail id={recordId} origin="inbox" />;
    case "ops":
      return <LoadedAssignDetail id={recordId} origin="inbox" />;
    case "venue":
      return <BookingDetail id={recordId} origin="inbox" />;
    case "technical":
      return <ReservationDetail id={recordId} origin="inbox" />;
    case "requester":
      // The Organiser's request page has no inbox trail yet; open it as is.
      redirect(`/staff/requester/${recordId}`);
  }
}
