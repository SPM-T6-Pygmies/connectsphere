import {
  ArchiveIcon,
  BellIcon,
  Building2Icon,
  CalendarCheckIcon,
  CheckIcon,
  FilePlusIcon,
  InboxIcon,
  MapPinIcon,
  ProjectorIcon,
  SendIcon,
  UserCheckIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  bookingById,
  eventById,
  reservationById,
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
  ops: [
    { section: "unassigned", title: "Unassigned", url: "/staff/ops", icon: InboxIcon },
    { section: "assigned", title: "Assigned", url: "/staff/ops/assigned", icon: UserCheckIcon },
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
 * path segment as a fixture id, so a section index page (e.g. "/staff/ops/
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

  if (role === "ops") {
    if (pathname === "/staff/ops") return "unassigned"
    if (pathname.startsWith("/staff/ops/assigned")) return "assigned"
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

  // technical
  if (pathname === "/staff/technical") return "needsReview"
  if (pathname.startsWith("/staff/technical/reviewed")) return "reviewed"
  if (pathname.startsWith("/staff/technical/archive")) return "archive"
  const entry = reservationById(pathname.split("/")[3] ?? "")
  if (!entry) return "needsReview"
  if (entry.reservation.status === "Requested") return "needsReview"
  if (["Reserved", "Partially Reserved", "Unavailable"].includes(entry.reservation.status)) {
    return "reviewed"
  }
  return "archive" // Released | Returned
}
