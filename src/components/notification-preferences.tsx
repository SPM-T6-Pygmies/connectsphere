"use client"

import { usePreferences, WorkflowCriticalityEnum } from "@novu/nextjs/hooks"
import { LockIcon } from "lucide-react"

import { preferenceRows } from "@/components/preference-rows"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"

/**
 * Which notifications the member gets, and where (SPM-180) -- SPM-47's
 * "configurable per notification type". The choices are Novu's, saved to it
 * as they are switched.
 *
 * Mounted only while open, and only under Novu's provider.
 */
function PreferenceList() {
  // All, not Novu's default of non-critical only: a locked type should still
  // be listed, as locked, rather than vanish.
  const { preferences = [], isLoading } = usePreferences({
    filter: { criticality: WorkflowCriticalityEnum.ALL },
  })
  const rows = preferenceRows(preferences)

  if (isLoading) {
    return null
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground px-4 text-sm">Nothing to choose yet.</p>
  }

  return (
    <div className="divide-y border-y">
      {rows.map((row) => (
        <section key={row.workflowId} className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{row.name}</h3>
            {row.locked ? (
              <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
                <LockIcon className="size-3" />
                Always on
              </span>
            ) : null}
          </div>
          {row.channels.map(({ channel, label, enabled }) => {
            const id = `preference-${row.workflowId}-${channel}`
            return (
              <div key={channel} className="flex items-center justify-between gap-4">
                <Label htmlFor={id} className="text-muted-foreground font-normal">
                  {label}
                </Label>
                <Switch
                  id={id}
                  checked={enabled}
                  disabled={row.locked}
                  onCheckedChange={(checked) => {
                    const preference = preferences.find(
                      (candidate) => candidate.workflow?.id === row.workflowId,
                    )
                    void preference?.update({ channels: { [channel]: checked } })
                  }}
                />
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

export function NotificationPreferences({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notification preferences</SheetTitle>
          <SheetDescription>
            Choose where each kind of notification reaches you.
          </SheetDescription>
        </SheetHeader>
        {open ? <PreferenceList /> : null}
      </SheetContent>
    </Sheet>
  )
}
