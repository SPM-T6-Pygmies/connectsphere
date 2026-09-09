"use client"

import {
  CalendarCheckIcon,
  ClipboardListIcon,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ROLE_LABELS, type StaffRole } from "@/lib/wireframe"

interface NavItem {
  readonly title: string
  readonly url: string
  readonly icon: LucideIcon
}

/**
 * What each role sees. Only the acting role's items are rendered -- the point
 * of the wireframes is to show the flow one desk at a time, not every screen
 * at once.
 */
const ROLE_NAV: Record<StaffRole, readonly NavItem[]> = {
  requester: [
    { title: "My requests", url: "/staff/requester", icon: ClipboardListIcon },
    { title: "New request", url: "/staff/requester/new", icon: FilePlusIcon },
  ],
  ops: [{ title: "Assignment queue", url: "/staff/ops", icon: InboxIcon }],
  coordinator: [
    { title: "My events", url: "/staff/coordinator", icon: CalendarCheckIcon },
  ],
  venue: [
    { title: "Booking requests", url: "/staff/venue", icon: MapPinIcon },
  ],
  technical: [
    { title: "Equipment reviews", url: "/staff/technical", icon: ProjectorIcon },
  ],
}

const PUBLIC_NAV: readonly NavItem[] = [
  { title: "Public event list", url: "/events", icon: UsersIcon },
]

export function AppSidebar({
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & { role: StaffRole }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LayoutGridIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">ConnectSphere</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Event planning
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{ROLE_LABELS[role]}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ROLE_NAV[role].map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Attendee-facing</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PUBLIC_NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <RoleSwitcher role={role} />
      </SidebarFooter>
    </Sidebar>
  )
}
