import { railItems } from "@/components/staff-nav"
import type { ListPaneItem, NotificationTrigger, StaffRole } from "@/lib/wireframe"

/** The part of a Novu inbox notification the staff inbox shows. */
export interface InboxNotification {
  readonly id: string
  readonly subject?: string
  readonly body: string
  readonly createdAt: string
  readonly isRead: boolean
  readonly isArchived: boolean
  readonly redirect?: { readonly url?: string }
  readonly tags?: readonly string[]
}

/**
 * The §6 trigger each Novu workflow delivers, by the tag the workflow carries
 * -- Novu's inbox API returns a notification's tags, not its workflow.
 */
const TRIGGERS: Readonly<Record<string, NotificationTrigger>> = {
  "coordinator-assigned": "Coordinator assigned",
}

/**
 * Where opening a notification goes.
 *
 * A notification's redirect is the record's own route, `/staff/<role>/<id>`.
 * The inbox opens that record under `/staff/<role>/notifications/<id>`
 * instead, so the rail stays on Notifications with the list beside it. A
 * redirect anywhere else -- a queue, another role's workspace -- is followed
 * as it is.
 */
function inboxHref(role: StaffRole, url: string | undefined): string {
  const inbox = `/staff/${role}/notifications`
  if (url === undefined) {
    return inbox
  }

  const record = new RegExp(`^/staff/${role}/([^/?#]+)$`).exec(url)
  const isQueue = railItems(role).some((item) => item.url === url)

  return record === null || isQueue ? url : `${inbox}/${record[1]}`
}

/** A row of the inbox list: a list-pane row that can also be archived (SPM-179). */
export interface NotificationRow extends ListPaneItem {
  readonly archived: boolean
}

/** One Novu notification as a row of the inbox list (SPM-174). */
export function notificationItem(role: StaffRole, notification: InboxNotification): NotificationRow {
  return {
    id: notification.id,
    href: inboxHref(role, notification.redirect?.url),
    title: notification.subject ?? notification.body,
    // The system is Singapore-time only (#36), and this renders in the browser.
    meta: new Date(notification.createdAt).toLocaleDateString("en-SG", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Singapore",
    }),
    teaser: notification.body,
    status: notification.tags?.map((tag) => TRIGGERS[tag]).find((trigger) => trigger !== undefined),
    unread: !notification.isRead,
    archived: notification.isArchived,
  }
}
