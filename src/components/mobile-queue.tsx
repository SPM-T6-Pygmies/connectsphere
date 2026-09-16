"use client"

import { usePathname } from "next/navigation"

import { QueueList } from "@/components/queue-list"
import { isRailDestination, resolveQueue } from "@/components/staff-nav"
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

  // Detail routes are full-screen, and the requester's "action" entries (New
  // request, Organisation events) are not queues.
  if (!isRailDestination(role, pathname)) {
    return null
  }

  const { section, heading, items, unread } = resolveQueue({
    role,
    pathname,
    activeSection,
    queueItems,
  })

  return (
    <section className="-mx-4 -mt-4 border-b md:hidden">
      <div className="flex w-full items-center justify-between gap-2 border-b p-4">
        <div className="text-foreground truncate text-base font-medium">
          {heading}
        </div>
        {section === "notifications" && unread > 0 ? (
          <Badge variant="warning" className="shrink-0">
            {unread} unread
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">{items.length}</span>
        )}
      </div>
      <QueueList items={items} activePath={pathname} />
    </section>
  )
}
