import {
  ArchiveIcon,
  BanIcon,
  BellIcon,
  Building2Icon,
  CalendarCheckIcon,
  CheckIcon,
  FilePlusIcon,
  InboxIcon,
  MapPinIcon,
  PackageIcon,
  ProjectorIcon,
  SendIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  bookingById,
  eventById,
  listPaneItems,
  type ListPaneItem,
  type SidebarSection,
  type StaffRole,
} from "@/lib/wireframe"

/**
 * Where each role can go, and which of those places a path belongs to.
 *
 * Extracted from `app-sidebar.tsx` because three surfaces now read it: the
 * desktop rail, the mobile drawer (the same rail, unclipped) and the mobile
 * bottom bar.
 *
 * Deliberately has no "use client" directive and no hooks, so it can be read
 * from either graph. Keep it that way -- adding a hook here would not fail
 * `pnpm lint`, only `pnpm build`.
 */

export interface RailItem {
  readonly section: SidebarSection | "action"
  readonly title: string
  readonly url: string
  readonly icon: LucideIcon
}

/** The rail entries each role works, named in their own vocabulary. */
export const RAIL: Record<StaffRole, RailItem[]> = {
  requester: [
    { section: "drafts", title: "Drafts", url: "/staff/requester", icon: InboxIcon },
    { section: "submitted", title: "Submitted", url: "/staff/requester/submitted", icon: SendIcon },
  ],
  lead: [
    { section: "unassigned", title: "Unassigned", url: "/staff/lead", icon: InboxIcon },
    { section: "assigned", title: "Assigned", url: "/staff/lead/assigned", icon: UserCheckIcon },
    { section: "coordinators", title: "Coordinators", url: "/staff/lead/coordinators", icon: UsersIcon },
  ],
  coordinator: [
    { section: "requests", title: "My requests", url: "/staff/coordinator", icon: InboxIcon },
    { section: "events", title: "My events", url: "/staff/coordinator/events", icon: CalendarCheckIcon },
    { section: "archive", title: "Archive", url: "/staff/coordinator/archive", icon: ArchiveIcon },
  ],
  venue: [
    { section: "requested", title: "Requests", url: "/staff/venue", icon: MapPinIcon },
    { section: "decided", title: "Decided", url: "/staff/venue/decided", icon: CheckIcon },
    { section: "archive", title: "Archive", url: "/staff/venue/archive", icon: ArchiveIcon },
  ],
  technical: [
    { section: "needsReview", title: "Needs review", url: "/staff/technical", icon: ProjectorIcon },
    { section: "reviewed", title: "Reviewed", url: "/staff/technical/reviewed", icon: CheckIcon },
    { section: "archive", title: "Archive", url: "/staff/technical/archive", icon: ArchiveIcon },
    // Not a queue of reservations: standing stock, so an "action" entry.
    { section: "action", title: "Equipment", url: "/staff/technical/equipment", icon: PackageIcon },
  ],
  safety: [
    { section: "awaitingCheck", title: "Awaiting check", url: "/staff/safety", icon: ShieldCheckIcon },
  ],
}

export function railItems(role: StaffRole): RailItem[] {
  const items: RailItem[] = [
    ...RAIL[role],
    {
      section: "notifications",
      title: "Notifications",
      url: `/staff/${role}/notifications`,
      icon: BellIcon,
    },
  ]

  if (role === "coordinator") {
    items.push({
      section: "action",
      title: "Find a venue",
      url: "/staff/coordinator/venues",
      icon: Building2Icon,
    })
  }

  if (role === "venue") {
    items.push({
      section: "action",
      title: "Venues",
      url: "/staff/venue/catalogue",
      icon: Building2Icon,
    })
    items.push({
      section: "action",
      title: "Unavailability",
      url: "/staff/venue/unavailability",
      icon: BanIcon,
    })
  }

  if (role === "requester") {
    items.push(
      {
        section: "action",
        title: "Organisation events",
        url: "/staff/requester/organisation",
        icon: Building2Icon,
      },
      {
        section: "action",
        title: "New request",
        url: "/staff/requester/new",
        icon: FilePlusIcon,
      },
    )
  }

  return items
}

/**
 * Which section of the rail a path belongs to.
 *
 * Each role's static nested routes are checked before ever treating the last
 * path segment as a fixture id, so a section index page (e.g. "/staff/lead/
 * assigned") is never mistaken for a detail route -- only what's left over
 * after those checks is looked up as a record, and branched on its status.
 */
export function currentSection(role: StaffRole, pathname: string): SidebarSection {
  if (pathname.startsWith(`/staff/${role}/notifications`)) return "notifications"

  if (role === "requester") {
    if (pathname === "/staff/requester" || pathname.startsWith("/staff/requester/new")) {
      return "drafts"
    }
    if (pathname.startsWith("/staff/requester/submitted")) return "submitted"
    return "submitted" // only remaining shape is /staff/requester/[id], never a draft
  }

  if (role === "lead") {
    if (pathname === "/staff/lead") return "unassigned"
    if (pathname.startsWith("/staff/lead/assigned")) return "assigned"
    if (pathname.startsWith("/staff/lead/coordinators") || pathname.startsWith("/staff/lead/events")) {
      return "coordinators"
    }
    const event = eventById(pathname.split("/")[3] ?? "")
    return event?.request.assignedCoordinator !== null ? "assigned" : "unassigned"
  }

  if (role === "coordinator") {
    if (pathname.startsWith("/staff/coordinator/events")) return "events"
    if (pathname.startsWith("/staff/coordinator/archive")) return "archive"
    if (pathname === "/staff/coordinator") return "requests"
    const event = eventById(pathname.split("/")[3] ?? "")
    if (!event) return "requests"
    if (event.request.status === "Approved") return "events"
    if (["Rejected", "Returned", "Withdrawn"].includes(event.request.status)) return "archive"
    return "requests" // Submitted | Under Review
  }

  if (role === "venue") {
    if (pathname === "/staff/venue") return "requested"
    if (pathname.startsWith("/staff/venue/decided")) return "decided"
    if (pathname.startsWith("/staff/venue/archive")) return "archive"
    const entry = bookingById(pathname.split("/")[3] ?? "")
    if (!entry) return "requested"
    if (entry.booking.status === "Requested") return "requested"
    if (entry.booking.status === "Tentative Hold" || entry.booking.status === "Confirmed") {
      return "decided"
    }
    return "archive" // Rejected | Released | Cancelled
  }

  if (role === "safety") return "awaitingCheck"

  // technical: an event page passes the list it is on as `activeSection`.
  if (pathname.startsWith("/staff/technical/reviewed")) return "reviewed"
  if (pathname.startsWith("/staff/technical/archive")) return "archive"
  return "needsReview"
}

/**
 * Whether this path is one of the role's rail destinations -- i.e. a queue
 * index, not a detail route and not one of the requester's "action" entries.
 *
 * Pathname-based rather than viewport-based on purpose: `usePathname()` is
 * stable during SSR, so the server HTML is already correct. `useIsMobile()`
 * reports false on the server and would pop the list in after hydration.
 */
export function isRailDestination(role: StaffRole, pathname: string): boolean {
  return railItems(role).some(
    (item) => item.section !== "action" && item.url === pathname,
  )
}

/**
 * What the list surfaces show for this path: which section is active, its
 * heading and its rows.
 *
 * Real data arrives as `queueItems` from the server; a role without it falls
 * back to the wireframe fixtures.
 * The inbox has no rows here: it renders its own list from Novu
 * (`NotificationList`).
 */
export function resolveQueue({
  role,
  pathname,
  activeSection,
  queueItems,
}: {
  role: StaffRole
  pathname: string
  activeSection?: SidebarSection
  queueItems?: readonly ListPaneItem[]
}): {
  section: SidebarSection
  heading: string
  items: readonly ListPaneItem[]
} {
  const section = activeSection ?? currentSection(role, pathname)
  const items =
    section === "notifications" ? [] : (queueItems ?? listPaneItems(role, section))

  return {
    section,
    heading: railItems(role).find((item) => item.section === section)?.title ?? "",
    items,
  }
}
