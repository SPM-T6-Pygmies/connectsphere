import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  actingCoordinator,
  actingOrganiser,
  buildViewAllEventCoordinators,
  buildViewAllEventRequests,
  buildViewAssignedEventRequests,
  buildViewAssignedEvents,
  buildViewMyEventRequests,
} from "@/composition/container"
import {
  ROLE_LABELS,
  type ListPaneItem,
  type SidebarSection,
  type StaffRole,
} from "@/lib/wireframe"

import { requestStateLabel } from "./coordinator/request-state-badge"

export { PageHeader } from "./page-header"

/**
 * The requester's own queue pane, from the same use case the "My event
 * requests" screen reads -- real submitted data, not the wireframe fixtures
 * `listPaneItems` still falls back to for every other role's queue.
 */
async function getQueueItemsForRequester(): Promise<ListPaneItem[]> {
  const organiser = actingOrganiser()
  const viewMyEventRequests = await buildViewMyEventRequests()
  const { eventRequests } = await viewMyEventRequests.execute(organiser)

  return eventRequests.map((request) => ({
    id: request.id,
    href:
      request.status === "Draft"
        ? `/staff/requester/new?draft=${request.id}`
        : `/staff/requester/${request.id}`,
    title: request.eventName,
    meta: request.preferredDate ?? "No date",
    teaser: request.description ?? "Nothing filled in yet.",
    status: request.status,
  }))
}

async function getQueueItemsForOps(assigned: boolean): Promise<ListPaneItem[]> {
  const [viewAllEventRequests, viewAllEventCoordinators] = await Promise.all([
    buildViewAllEventRequests(),
    buildViewAllEventCoordinators(),
  ])
  const [{ eventRequests }, { eventCoordinators }] = await Promise.all([
    viewAllEventRequests.execute(),
    viewAllEventCoordinators.execute(),
  ])
  const coordinatorNames = new Map(
    eventCoordinators.map((coordinator) => [coordinator.userAccountId, coordinator.name]),
  )

  return eventRequests
    .filter(
      (request) =>
        request.status !== "Draft" &&
        (request.assignedCoordinatorUserAccountId !== null) === assigned,
    )
    .map((request) => ({
      id: request.id,
      href: `/staff/ops/${request.id}`,
      title: request.eventName,
      meta: request.preferredDate ?? "No date",
      teaser:
        request.assignedCoordinatorUserAccountId === null
          ? "No coordinator assigned yet."
          : coordinatorNames.get(request.assignedCoordinatorUserAccountId) ??
            "Coordinator assigned",
      status: request.status,
    }))
}

/**
 * The coordinator's "My requests" queue pane, from the same use case the page
 * reads -- real assigned data, not the wireframe fixtures `listPaneItems`
 * still falls back to for "Archive" (out of scope for SPM-121/32 -- see
 * coordinator-detail.tsx).
 *
 * The pane shows the Coordinator's reading of each request, not the stored
 * status -- see `requestStateLabel`.
 */
async function getQueueItemsForCoordinatorRequests(): Promise<ListPaneItem[]> {
  const coordinator = actingCoordinator()
  const viewAssignedEventRequests = await buildViewAssignedEventRequests()
  const { eventRequests } = await viewAssignedEventRequests.execute(coordinator)

  return eventRequests.map((request) => ({
    id: request.id,
    href: `/staff/coordinator/${request.id}`,
    title: request.eventName,
    meta: request.preferredDate ?? "No date",
    teaser: request.clientOrganisationName,
    status: requestStateLabel(request.state),
  }))
}

/** The coordinator's "My events" queue pane, from the same use case the page reads (SPM-137). */
async function getQueueItemsForCoordinatorEvents(): Promise<ListPaneItem[]> {
  const coordinator = actingCoordinator()
  const viewAssignedEvents = await buildViewAssignedEvents()
  const { events } = await viewAssignedEvents.execute(coordinator)

  return events.map((event) => ({
    id: event.id,
    href: `/staff/coordinator/${event.id}`,
    title: event.name,
    meta: event.preferredDate ?? "No date",
    teaser: event.clientOrganisationName,
    status: event.status,
  }))
}

async function getRespectiveQueueItems(
  role: StaffRole,
  crumbs: readonly Crumb[],
  coordinatorSection: CoordinatorSection,
): Promise<ListPaneItem[] | undefined> {
  if (role === "requester") {
    return getQueueItemsForRequester()
  }

  if (role === "ops") {
    const assigned = crumbs.some((crumb) => crumb.label === "Assigned")
    return getQueueItemsForOps(assigned)
  }

  if (role === "coordinator") {
    return coordinatorSection === "events"
      ? getQueueItemsForCoordinatorEvents()
      : getQueueItemsForCoordinatorRequests()
  }

  return undefined
}

/** Which of the coordinator's two panes to fill: their requests, or their events. */
export type CoordinatorSection = "requests" | "events"

export interface Crumb {
  readonly label: string
  readonly href?: string
}

/**
 * The chrome every staff screen sits in.
 *
 * Each page supplies its own crumbs and role rather than the layout deriving
 * them from the path: the role segment is already known statically per route,
 * and a page knows its own title better than a parser does.
 */
export async function StaffShell({
  role,
  crumbs,
  activeSection,
  defaultOpen = true,
  children,
  coordinatorSection = "requests",
}: {
  role: StaffRole
  crumbs: readonly Crumb[]
  /** Overrides path-based section inference for details loaded from real data. */
  activeSection?: SidebarSection
  /**
   * Whether the list pane starts open.
   *
   * Queue screens pass false: their table already shows everything at a
   * glance, and a navigator repeating it in 20rem beside it earns nothing.
   * Detail and inbox screens keep it, because there the pane is how you get
   * to the next thing. The header trigger overrides either way.
   */
  defaultOpen?: boolean
  children: ReactNode
  coordinatorSection?: CoordinatorSection
}) {
  const queueItems = await getRespectiveQueueItems(role, crumbs, coordinatorSection)

  return (
    // The two-pane sidebar is the icon rail plus a list pane, so it needs the
    // wider track; the rail's own width comes from --sidebar-width-icon.
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={{ "--sidebar-width": "23rem" } as CSSProperties}
    >
      <AppSidebar role={role} queueItems={queueItems} activeSection={activeSection} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link href={`/staff/${role}`}>{ROLE_LABELS[role]}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {crumbs.map((crumb, index) => (
                <div key={crumb.label} className="contents">
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    {crumb.href && index < crumbs.length - 1 ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
