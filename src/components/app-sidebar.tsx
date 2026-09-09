"use client"

import {
  BellIcon,
  CalendarCheckIcon,
  FilePlusIcon,
  InboxIcon,
  LayoutGridIcon,
  MapPinIcon,
  ProjectorIcon,
  UsersIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import { RoleSwitcher } from "@/components/role-switcher"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  listPaneItems,
  ROLE_LABELS,
  unreadCount,
  type SidebarSection,
  type StaffRole,
} from "@/lib/wireframe"

interface RailItem {
  readonly section: SidebarSection | "action"
  readonly title: string
  readonly url: string
  readonly icon: LucideIcon
}

/** The queue each role works, named in their own vocabulary. */
const QUEUE: Record<StaffRole, { title: string; icon: LucideIcon }> = {
  requester: { title: "My requests", icon: InboxIcon },
  ops: { title: "Assignment queue", icon: InboxIcon },
  coordinator: { title: "My events", icon: CalendarCheckIcon },
  venue: { title: "Booking requests", icon: MapPinIcon },
  technical: { title: "Equipment reviews", icon: ProjectorIcon },
}

function railItems(role: StaffRole): RailItem[] {
  const items: RailItem[] = [
    {
      section: "queue",
      title: QUEUE[role].title,
      url: `/staff/${role}`,
      icon: QUEUE[role].icon,
    },
    {
      section: "notifications",
      title: "Notifications",
      url: `/staff/${role}/notifications`,
      icon: BellIcon,
    },
  ]

  if (role === "requester") {
    items.push({
      section: "action",
      title: "New request",
      url: "/staff/requester/new",
      icon: FilePlusIcon,
    })
  }

  return items
}

/**
 * The staff shell: an icon rail, a list of what the acting role is working
 * through, and the detail beside it.
 *
 * Which list shows is read from the path rather than held in state, so the
 * pane always agrees with the page next to it and a link into a queue arrives
 * with the right list already open.
 */
export function AppSidebar({
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & { role: StaffRole }) {
  const pathname = usePathname()
  const rail = railItems(role)

  const section: SidebarSection = pathname.startsWith(
    `/staff/${role}/notifications`,
  )
    ? "notifications"
    : "queue"

  const items = listPaneItems(role, section)
  const unread = unreadCount(role)
  const heading = section === "notifications" ? "Notifications" : QUEUE[role].title

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* The icon rail. Never collapses; it is the role's whole navigation. */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <Link href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <LayoutGridIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">ConnectSphere</span>
                    <span className="truncate text-xs">
                      {ROLE_LABELS[role]}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {rail.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      tooltip={{ children: item.title, hidden: false }}
                      isActive={
                        item.section === "action"
                          ? pathname === item.url
                          : item.section === section
                      }
                      className="relative px-2.5 md:px-2"
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                        {item.section === "notifications" && unread > 0 ? (
                          <span className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" />
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-auto">
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={{ children: "Public event list", hidden: false }}
                    className="px-2.5 md:px-2"
                  >
                    <Link href="/events">
                      <UsersIcon />
                      <span>Public event list</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <RoleSwitcher role={role} />
        </SidebarFooter>
      </Sidebar>

      {/* The list pane: what this role is working through. */}
      {/*
        w-auto matters: collapsible="none" hard-sets w-(--sidebar-width), which
        would size this pane to the whole track and let it slide under the
        rail. cn() merges the two widths, so w-auto wins and flex-1 fills
        whatever the rail leaves.
      */}
      <Sidebar
        collapsible="none"
        className="hidden w-auto min-w-0 flex-1 md:flex"
      >
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="text-foreground truncate text-base font-medium">
              {heading}
            </div>
            {section === "notifications" && unread > 0 ? (
              <Badge variant="warning" className="shrink-0">
                {unread} unread
              </Badge>
            ) : (
              <span className="text-muted-foreground text-xs">
                {items.length}
              </span>
            )}
          </div>
          <SidebarInput placeholder="Type to search…" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {items.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  Nothing here.
                </p>
              ) : (
                items.map((item) => {
                  const active = pathname === item.href.split("?")[0]

                  return (
                    <Link
                      href={item.href}
                      key={item.id}
                      className={`hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full min-w-0 flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0 ${
                        active ? "bg-sidebar-accent" : ""
                      }`}
                    >
                      <div className="flex w-full min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate font-medium">
                          {item.title}
                        </span>
                        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                          {item.meta}
                        </span>
                      </div>
                      <div className="flex w-full min-w-0 items-center gap-2">
                        <span className="text-muted-foreground min-w-0 truncate text-xs">
                          {item.status}
                        </span>
                        {item.unread ? (
                          <span className="bg-primary ml-auto size-1.5 shrink-0 rounded-full" />
                        ) : null}
                      </div>
                      <span className="line-clamp-2 w-full text-xs whitespace-break-spaces">
                        {item.teaser}
                      </span>
                    </Link>
                  )
                })
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
