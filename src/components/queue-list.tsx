import Link from "next/link"

import { StatusBadge } from "@/app/staff/status-badge"
import type { ListPaneItem } from "@/lib/wireframe"

/**
 * The rows of whatever the acting role is working through.
 *
 * One markup, two surfaces: the desktop list pane renders it inside the
 * sidebar, and below md it is the page body itself -- which is the only way
 * ops, venue and technical can reach their queue on a phone, their index
 * routes having nothing but a `QueueEmptyState` of their own.
 *
 * Takes the active path as a prop rather than calling `usePathname()`, so it
 * stays free of hooks and renders from either graph.
 */
export function QueueList({
  items,
  activePath,
}: {
  items: readonly ListPaneItem[]
  activePath?: string
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground p-4 text-sm">Nothing here.</p>
  }

  return (
    <>
      {items.map((item) => {
        const active = activePath === item.href.split("?")[0]

        return (
          <Link
            href={item.href}
            key={item.id}
            className={`hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full min-w-0 flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0 ${
              active ? "bg-sidebar-accent" : ""
            }`}
          >
            <div className="flex w-full min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-medium">{item.title}</span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                {item.meta}
              </span>
            </div>
            <div className="flex w-full min-w-0 items-center gap-2">
              <StatusBadge status={item.status} />
              {item.unread ? (
                <span className="bg-primary ml-auto size-1.5 shrink-0 rounded-full" />
              ) : null}
            </div>
            <span className="line-clamp-2 w-full text-xs whitespace-break-spaces">
              {item.teaser}
            </span>
          </Link>
        )
      })}
    </>
  )
}
