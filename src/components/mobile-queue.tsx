"use client"

import { usePathname } from "next/navigation"

import { NotificationList, NotificationMenu } from "@/components/notification-list"
import { QueueList } from "@/components/queue-list"
import { isRailDestination, resolveQueue } from "@/components/staff-nav"
import { useStaffNotifications } from "@/components/staff-notifications"
import { Badge } from "@/components/ui/badge"
import type { ListPaneItem, SidebarSection, StaffRole } from "@/lib/wireframe"

/**
 * The role's queue, as the page body, below md.
 *
 * On a phone there is no list pane -- so this is the only way ops, venue and
 * technical reach their work at all, their index routes rendering nothing but
 * a `QueueEmptyState` ("items exist in the pane, nothing open yet"), which is
 * a two-pane idea with no meaning on one screen.
 *
 * Hidden by CSS rather than by `useIsMobile()`: the rows are in the server
 * HTML either way, so nothing pops in after hydration.
 */
export function MobileQueue({
  role,
  activeSection,
  queueItems,
}: {
  role: StaffRole
  activeSection?: SidebarSection
  queueItems?: readonly ListPaneItem[]
}) {
  const pathname = usePathname()
  const { unread, view } = useStaffNotifications()

  // Detail routes are full-screen, and the requester's "action" entries (New
  // request, Organisation events) are not queues.
  if (!isRailDestination(role, pathname)) {
    return null
  }

  const { section, heading, items } = resolveQueue({
    role,
    pathname,
    activeSection,
    queueItems,
  })

  return (
    <section className="-mx-4 -mt-4 border-b md:hidden">
      <div className="flex w-full items-center justify-between gap-2 border-b p-4">
        <div className="text-foreground truncate text-base font-medium">
          {section === "notifications" && view === "archived" ? "Archived" : heading}
        </div>
        {section === "notifications" ? (
          <div className="flex shrink-0 items-center gap-1">
            {unread > 0 ? <Badge variant="warning">{unread} unread</Badge> : null}
            <NotificationMenu />
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">{items.length}</span>
        )}
      </div>
      {section === "notifications" ? (
        <NotificationList activePath={pathname} />
      ) : (
        <QueueList items={items} activePath={pathname} />
      )}
    </section>
  )
}
