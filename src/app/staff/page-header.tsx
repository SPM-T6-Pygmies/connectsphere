import type { ReactNode } from "react"

/**
 * Title + supporting line + optional actions, repeated on every screen.
 *
 * Kept in its own module, separate from `StaffShell`: a Client Component
 * (`new-request-form.tsx`) uses only this, and `StaffShell` now pulls in the
 * composition root (server-only, needs `next/headers`) to fetch the
 * requester's queue -- sharing a file would drag that into the client bundle.
 */
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
