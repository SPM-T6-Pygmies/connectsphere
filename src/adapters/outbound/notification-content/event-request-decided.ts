import type { NotificationMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import type { EventRequestDecidedNotice } from "@/core/ports/outbound/notifier";

/**
 * The words an Organiser reads when their request is decided (SPM-60).
 *
 * An approval lets planning begin but commits ConnectSphere to nothing yet
 * (AC2, #80): the event is confirmed later, once its arrangements are in
 * place. A rejection carries the coordinator's reason (AC3) and offers no way
 * back -- rejection is terminal (SPM-34).
 */
export function eventRequestDecidedMessage(notice: EventRequestDecidedNotice): NotificationMessage {
  if (notice.decision === "rejected") {
    return {
      subject: `${notice.eventName} was rejected`,
      body: `Your coordinator rejected ${notice.eventName}. Reason: ${notice.decisionRecord ?? "none given"}`,
    };
  }

  const approved = `Your coordinator approved ${notice.eventName}. Planning can begin, but ConnectSphere is not yet committed to any arrangement.`;
  return {
    subject: `${notice.eventName} was approved`,
    body: notice.decisionRecord === null ? approved : `${approved} Note: ${notice.decisionRecord}`,
  };
}
