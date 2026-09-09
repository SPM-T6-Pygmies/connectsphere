import type { ReactNode } from "react"

/**
 * A labelled read-only field grid.
 *
 * Every staff screen displays request and event fields this way, so the
 * "not supplied" treatment is decided once rather than per screen -- which is
 * what makes a half-filled draft legible instead of just sparse.
 */
export function FieldList({
  fields,
  columns = 2,
}: {
  fields: ReadonlyArray<{ label: string; value: ReactNode }>
  columns?: 1 | 2
}) {
  return (
    <dl
      className={
        columns === 2
          ? "grid gap-x-8 gap-y-4 sm:grid-cols-2"
          : "grid gap-y-4"
      }
    >
      {fields.map((field) => (
        <div key={field.label} className="space-y-0.5">
          <dt className="text-xs font-medium text-muted-foreground">
            {field.label}
          </dt>
          <dd className="text-sm">
            {field.value ?? (
              <span className="text-muted-foreground italic">Not supplied</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
