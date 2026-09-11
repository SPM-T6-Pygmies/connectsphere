import { notFound } from "next/navigation";

import { NOTIFICATIONS, type StaffRole } from "@/lib/wireframe";

import { CoordinatorDetail } from "./coordinator/coordinator-detail";
import { AssignDetail } from "./ops/assign-detail";
import { RequestDetail } from "./requester/request-detail";
import { ReservationDetail } from "./technical/reservation-detail";
import { BookingDetail } from "./venue/booking-detail";

/**
 * A notification opened from the inbox.
 *
 * Renders the record the notification concerns, in the same component its own
 * route uses -- a notification points at something rather than restating it,
 * so there is nothing here to render on its own.
 *
 * The route sits under /notifications, which is the whole point: the sidebar
 * reads its section from the path, so the inbox list stays open beside this
 * and the next notification is one click away.
 */
export function NotificationDetail({
  role,
  notificationId,
}: {
  role: StaffRole;
  notificationId: string;
  tab?: string | string[];
  activity?: string | string[];
}) {
  const notification = NOTIFICATIONS.find(
    (candidate) =>
      candidate.id === notificationId && candidate.recipient === role,
  );

  if (!notification) {
    notFound();
  }

  const { target } = notification;

  switch (target.kind) {
    case "request":
      return <RequestDetail id={target.id} origin="inbox" />;
    case "assign":
      return <AssignDetail id={target.id} origin="inbox" />;
    case "event":
      return (
        <CoordinatorDetail id={target.id} origin="inbox" />
      );
    case "booking":
      return <BookingDetail id={target.id} origin="inbox" />;
    case "reservation":
      return <ReservationDetail id={target.id} origin="inbox" />;
  }
}
