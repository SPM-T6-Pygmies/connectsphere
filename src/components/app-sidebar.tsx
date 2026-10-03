"use client"

import { LayoutGridIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import { AccountMenu } from "@/components/account-menu"
import { QueueList } from "@/components/queue-list"
import { railItems, resolveQueue } from "@/components/staff-nav"
import { useStaffNotifications } from "@/components/staff-notifications"
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
  ROLE_LABELS,
  type ListPaneItem,
  type SidebarSection,
  type StaffRole,
} from "@/lib/wireframe"

/**
 * The staff shell: an icon rail, a list of what the acting role is working
 * through, and the detail beside it.
 *
 * Which list shows normally comes from the path. A real-data detail may supply
 * its section because its id cannot be resolved through the wireframe fixtures.
 */
export function AppSidebar({
  role,
  name,
  queueItems,
  activeSection,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role: StaffRole
  /** The signed-in member of staff's name, for the account menu. */
  name: string
  /** The role's queue, fetched from real data server-side. Falls back to wireframe fixtures when omitted. */
  queueItems?: readonly ListPaneItem[]
  /** The real record's section when its id is not part of the wireframe fixtures. */
  activeSection?: SidebarSection
}) {
  const pathname = usePathname()
  const rail = railItems(role)
  const notifications = useStaffNotifications()
  const { unread } = notifications

  const { section, heading, items } = resolveQueue({
    role,
    pathname,
    activeSection,
    queueItems,
    notifications: notifications.items,
  })

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/*
        The icon rail. Never collapses; it is the role's whole navigation.

        Below md this is the whole drawer, so it takes the sheet's full width
        and shows its labels: the label-hiding CSS keys off the desktop
        `.group[data-collapsible]` wrapper, which the mobile Sheet branch of
        `Sidebar` never renders. Pinning it to the icon width there is what
        left the drawer a clipped 3rem strip beside 15rem of dead space.
      */}
      <Sidebar
        collapsible="none"
        className="w-full md:w-[calc(var(--sidebar-width-icon)+1px)]! md:border-r"
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
          <AccountMenu name={name} role={role} />
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
              <QueueList
                items={items}
                activePath={pathname}
                onOpen={section === "notifications" ? notifications.markRead : undefined}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
