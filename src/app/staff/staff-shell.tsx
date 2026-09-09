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
import { ROLE_LABELS, type StaffRole } from "@/lib/wireframe"

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
export function StaffShell({
  role,
  crumbs,
  children,
}: {
  role: StaffRole
  crumbs: readonly Crumb[]
  children: ReactNode
}) {
  return (
    // The two-pane sidebar is the icon rail plus a list pane, so it needs the
    // wider track; the rail's own width comes from --sidebar-width-icon.
    <SidebarProvider
      style={{ "--sidebar-width": "23rem" } as CSSProperties}
    >
      <AppSidebar role={role} />
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

/** Title + supporting line + optional actions, repeated on every screen. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  )
}
