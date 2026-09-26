"use client"

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MailIcon,
  MailOpenIcon,
  MoreHorizontalIcon,
} from "lucide-react"
import Link from "next/link"

import { StatusBadge } from "@/app/staff/status-badge"
import { useStaffNotifications } from "@/components/staff-notifications"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * The inbox's rows, with Novu's triage actions on each (SPM-179).
 *
 * Its own list rather than `QueueList`: a row here holds buttons, and a button
 * cannot sit inside the link a `QueueList` row is. The actions show on hover
 * from md up, and always below it, where there is no hover.
 */
export function NotificationList({ activePath }: { activePath: string }) {
  const { view, items, markRead, toggleRead, toggleArchived } = useStaffNotifications()

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        {view === "archived" ? "Nothing archived." : "Nothing here."}
      </p>
    )
  }

  return (
    <>
      {items.map((item) => (
        <div
          key={item.id}
          className={`group/row hover:bg-sidebar-accent relative border-b last:border-b-0 ${
            activePath === item.href ? "bg-sidebar-accent" : ""
          }`}
        >
          <Link
            href={item.href}
            onClick={() => markRead(item.id)}
            className="hover:text-sidebar-accent-foreground flex w-full min-w-0 flex-col items-start gap-2 p-4 pb-12 text-sm leading-tight md:pb-4"
          >
            <div className="flex w-full min-w-0 items-center gap-2">
              {item.unread ? (
                <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-label="Unread" />
              ) : null}
              <span className={`min-w-0 truncate ${item.unread ? "font-medium" : ""}`}>
                {item.title}
              </span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs">{item.meta}</span>
            </div>
            {item.status ? <StatusBadge status={item.status} /> : null}
            <span className="text-muted-foreground line-clamp-2 w-full text-xs">{item.teaser}</span>
          </Link>
          <div className="bg-sidebar-accent absolute right-2 bottom-2 flex gap-0.5 rounded-md md:top-3 md:bottom-auto md:opacity-0 md:group-hover/row:opacity-100 md:focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleRead(item.id)}
              aria-label={item.unread ? "Mark as read" : "Mark as unread"}
              title={item.unread ? "Mark as read" : "Mark as unread"}
            >
              {item.unread ? <MailOpenIcon /> : <MailIcon />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleArchived(item.id)}
              aria-label={item.archived ? "Unarchive" : "Archive"}
              title={item.archived ? "Unarchive" : "Archive"}
            >
              {item.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            </Button>
          </div>
        </div>
      ))}
    </>
  )
}

/** The inbox list's menu: which view, and the bulk actions (SPM-179). */
export function NotificationMenu() {
  const { view, setView, unread, markAllRead, archiveAllRead } = useStaffNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Notification options">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={view}
          onValueChange={(value) => setView(value === "archived" ? "archived" : "inbox")}
        >
          <DropdownMenuRadioItem value="inbox">Inbox</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="archived">Archived</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={unread === 0} onSelect={markAllRead}>
          Mark all read
        </DropdownMenuItem>
        <DropdownMenuItem disabled={view === "archived"} onSelect={archiveAllRead}>
          Archive all read
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
