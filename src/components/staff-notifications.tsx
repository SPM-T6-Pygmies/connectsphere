"use client"

// The provider must come from the same entry as the hooks: the package root
// resolves to a different bundle, whose context the hooks cannot see.
import { NovuProvider, useCounts, useNotifications } from "@novu/nextjs/hooks"
import { createContext, useContext, useMemo, type ReactNode } from "react"

import { notificationItem } from "@/components/notification-items"
import type { ListPaneItem, StaffRole } from "@/lib/wireframe"

const APPLICATION_IDENTIFIER = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER

export interface StaffNotifications {
  /** True until Novu first answers, so an empty list is not mistaken for none. */
  readonly loading: boolean
  readonly items: readonly ListPaneItem[]
  readonly unread: number
  /** Marks one notification read -- on opening it. */
  readonly markRead: (id: string) => void
}

const NONE: StaffNotifications = {
  loading: false,
  items: [],
  unread: 0,
  markRead: () => {},
}

const Context = createContext<StaffNotifications>(NONE)

/** The signed-in member's notifications, for the rail, list pane and inbox. */
export function useStaffNotifications(): StaffNotifications {
  return useContext(Context)
}

function NovuFeed({ role, children }: { role: StaffRole; children: ReactNode }) {
  const { notifications = [], isLoading } = useNotifications()
  const { counts } = useCounts({ filters: [{ read: false }] })

  const value = useMemo<StaffNotifications>(
    () => ({
      loading: isLoading,
      items: notifications.map((notification) => notificationItem(role, notification)),
      unread: counts?.[0]?.count ?? 0,
      markRead: (id) => {
        const notification = notifications.find((candidate) => candidate.id === id)
        if (notification !== undefined && !notification.isRead) {
          void notification.read()
        }
      },
    }),
    [role, notifications, isLoading, counts],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

/**
 * The staff inbox's data, from Novu (SPM-174).
 *
 * Our own inbox screens render it; Novu only supplies the notifications, their
 * read state and live updates. `subscriberHash` is what lets Novu (with HMAC
 * on) trust that this subscriber id is the signed-in member's.
 *
 * Without Novu configured for the environment the inbox is simply empty.
 */
export function StaffNotificationsProvider({
  role,
  inbox,
  children,
}: {
  role: StaffRole
  inbox: { subscriberId: string; subscriberHash: string } | null
  children: ReactNode
}) {
  if (!APPLICATION_IDENTIFIER || inbox === null) {
    return <Context.Provider value={NONE}>{children}</Context.Provider>
  }

  return (
    <NovuProvider
      applicationIdentifier={APPLICATION_IDENTIFIER}
      subscriberId={inbox.subscriberId}
      subscriberHash={inbox.subscriberHash}
    >
      <NovuFeed role={role}>{children}</NovuFeed>
    </NovuProvider>
  )
}
