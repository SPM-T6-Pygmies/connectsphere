"use client"

import { MenuIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { currentSection, railItems } from "@/components/staff-nav"
import { useStaffNotifications } from "@/components/staff-notifications"
import { useSidebar } from "@/components/ui/sidebar"
import type { StaffRole } from "@/lib/wireframe"

/**
 * The role's destinations, as a floating bar, below md.
 *
 * This is the icon rail's mobile form. It cannot live inside `AppSidebar`:
 * below md that component's root *is* the drawer sheet, so a bar rendered
 * there would only exist while the drawer it opens is already open. It does
 * have to stay inside `SidebarProvider`, for `setOpenMobile`.
 *
 * Only the rail's queue destinations get a slot -- the "action" entries, the
 * public event list and the account menu stay in the drawer behind the last
 * button, which is what keeps the bar the same shape for every role.
 */
export function StaffBottomNav({ role }: { role: StaffRole }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  const section = currentSection(role, pathname)
  const destinations = railItems(role).filter((item) => item.section !== "action")
  const { unread } = useStaffNotifications()

  return (
    <nav
      aria-label="Staff sections"
      // pointer-events-none on the full-width strip, auto on the pill: without
      // the pair, the invisible strip either side of the pill eats taps.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="bg-background/85 pointer-events-auto flex items-center gap-1 rounded-full border p-1.5 shadow-lg backdrop-blur">
        {destinations.map((item) => (
          <Link
            key={item.url}
            href={item.url}
            aria-label={item.title}
            aria-current={item.section === section ? "page" : undefined}
            className={`relative flex size-11 items-center justify-center rounded-full transition-colors ${
              item.section === section
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground"
            }`}
          >
            <item.icon className="size-5" />
            {item.section === "notifications" && unread > 0 ? (
              <span className="bg-primary absolute top-2 right-2 size-1.5 rounded-full" />
            ) : null}
          </Link>
        ))}

        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-label="Open navigation"
          className="text-muted-foreground flex size-11 items-center justify-center rounded-full"
        >
          <MenuIcon className="size-5" />
        </button>
      </div>
    </nav>
  )
}
