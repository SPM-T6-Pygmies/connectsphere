import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { MobileQueue } from "@/components/mobile-queue"
import { StaffBottomNav } from "@/components/staff-bottom-nav"
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
  buildViewAllEventCoordinators,
  buildViewAllEventRequests,
  buildViewArchivedEventRequests,
  buildViewAssignedEventRequests,
  buildViewAssignedEvents,
  buildViewMyEventRequests,
  getCurrentCoordinator,
  getCurrentOrganiser,
  getSignedInStaffMember,
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
  const organiser = await getCurrentOrganiser()
  if (organiser === null) {
    return []
  }

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
    .filter((request) => request.queue === (assigned ? "assigned" : "unassigned"))
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
 * reads -- real assigned data, not the wireframe fixtures.
 *
 * The pane shows the Coordinator's reading of each request, not the stored
 * status -- see `requestStateLabel`.
 */
async function getQueueItemsForCoordinatorRequests(): Promise<ListPaneItem[]> {
  const coordinator = await getCurrentCoordinator()
  if (coordinator === null) {
    return []
  }

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

/** The coordinator's Archive pane, from the same use case the Archive page reads. */
async function getQueueItemsForCoordinatorArchive(): Promise<ListPaneItem[]> {
  const coordinator = await getCurrentCoordinator()
  if (coordinator === null) {
    return []
  }

  const viewArchivedEventRequests = await buildViewArchivedEventRequests()
  const { eventRequests } = await viewArchivedEventRequests.execute(coordinator)

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
  const coordinator = await getCurrentCoordinator()
  if (coordinator === null) {
    return []
  }

  const viewAssignedEvents = await buildViewAssignedEvents()
  const { events } = await viewAssignedEvents.execute(coordinator)

  return events.map((event) => ({
    id: event.id,
    // The approved request, until events get a page of their own (SPM-137).
    href:
      event.eventRequestId === null
        ? "/staff/coordinator/events"
        : `/staff/coordinator/${event.eventRequestId}`,
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
      : coordinatorSection === "archive"
        ? getQueueItemsForCoordinatorArchive()
        : getQueueItemsForCoordinatorRequests()
  }

  return undefined
}

/** Which of the coordinator's panes to fill: their open requests, their events, or their archive. */
export type CoordinatorSection = "requests" | "events" | "archive"

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
  // Every staff screen renders inside this shell, so this is where a signed-in
  // user who does not hold the screen's role gets a not-found -- before any
  // queue is read on their behalf.
  const member = await getSignedInStaffMember()
  if (member === null || !member.workspaces.includes(role)) {
    notFound()
  }

  const queueItems = await getRespectiveQueueItems(role, crumbs, coordinatorSection)

  // Detail screens route through `detailCrumbs`, which always gives two crumbs
  // with an href on the first; index screens give one with none. So the crumbs
  // already say both "is this a detail route" and where back goes -- and they
  // distinguish a record opened from its queue from the same record opened
  // from the inbox, which is what makes the arrow land where it came from.
  const backHref = crumbs.length > 1 ? crumbs.at(-2)?.href : undefined

  return (
    // The two-pane sidebar is the icon rail plus a list pane, so it needs the
    // wider track; the rail's own width comes from --sidebar-width-icon.
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={{ "--sidebar-width": "23rem" } as CSSProperties}
    >
      <AppSidebar
        role={role}
        name={member.name}
        queueItems={queueItems}
        activeSection={activeSection}
      />
      {/*
        min-w-0: SidebarInset is a flex item in SidebarProvider's row, so its
        default min-width:auto lets a table wider than the viewport widen the
        whole page instead of scrolling inside Table's own overflow-x-auto.
      */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          {/* Below md there is no list pane to toggle; the arrow goes back. */}
          <SidebarTrigger className="-ml-1 hidden md:flex" />
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Back"
              className="hover:bg-accent -ml-1 flex size-7 items-center justify-center rounded-md md:hidden"
            >
              <ArrowLeftIcon className="size-4" />
            </Link>
          ) : null}
          <Separator
            orientation="vertical"
            className="mr-2 hidden data-vertical:h-4 data-vertical:self-auto md:block"
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
        {/*
          The bottom bar is fixed, so it is out of flow: pad the content past
          it below md. md:pb-6 is spelled out rather than left to md:p-6 --
          Tailwind emits padding before padding-bottom, and media blocks carry
          no extra specificity, so relying on order would be a bet.
        */}
        <div className="flex flex-1 flex-col gap-6 p-4 pb-[calc(var(--staff-bottom-nav-height)+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          <MobileQueue
            role={role}
            activeSection={activeSection}
            queueItems={queueItems}
          />
          {children}
        </div>
      </SidebarInset>
      <StaffBottomNav role={role} />
    </SidebarProvider>
  )
}
