"use client"

import { ChevronsUpDownIcon, CheckIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ACTING_AS, ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/wireframe"

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
}

/**
 * The wireframe's stand-in for authentication.
 *
 * There is no login yet, so the acting persona is chosen here and carried in
 * the URL -- switching role is a navigation, which keeps every screen a
 * shareable link and saves the wireframes needing any client state.
 */
export function RoleSwitcher({ role }: { role: StaffRole }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const person = ACTING_AS[role]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">
                  {initials(person.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{person.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[role]}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Acting as
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STAFF_ROLES.map((candidate) => (
              <DropdownMenuItem
                key={candidate}
                onSelect={() => router.push(`/staff/${candidate}`)}
                className="gap-2"
              >
                <div className="grid flex-1 leading-tight">
                  <span className="text-sm">{ROLE_LABELS[candidate]}</span>
                  <span className="text-xs text-muted-foreground">
                    {ACTING_AS[candidate].name}
                  </span>
                </div>
                {candidate === role ? <CheckIcon className="size-4" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => router.push("/")}
              disabled={pathname === "/"}
            >
              Back to overview
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
