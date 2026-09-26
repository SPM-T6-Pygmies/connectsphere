"use client"

// The provider must come from the same entry as the hooks: the package root
// resolves to a different bundle, whose context the hooks cannot see.
import { NovuProvider, useCounts, useNotifications } from "@novu/nextjs/hooks"
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

import { notificationItem, type NotificationRow } from "@/components/notification-items"
import type { StaffRole } from "@/lib/wireframe"

const APPLICATION_IDENTIFIER = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER

/** Which of the member's notifications the list shows. */
export type NotificationView = "inbox" | "archived"

export interface StaffNotifications {
  /** True until Novu first answers, so an empty list is not mistaken for none. */
  readonly loading: boolean
  readonly view: NotificationView
  readonly setView: (view: NotificationView) => void
  /** The rows of the current view. */
  readonly items: readonly NotificationRow[]
  /** Unread and not archived, whatever the view. */
  readonly unread: number
  /** Marks one notification read -- on opening it. */
  readonly markRead: (id: string) => void
  readonly toggleRead: (id: string) => void
  readonly toggleArchived: (id: string) => void
  readonly markAllRead: () => void
  readonly archiveAllRead: () => void
}

const NONE: StaffNotifications = {
  loading: false,
  view: "inbox",
  setView: () => {},
  items: [],
  unread: 0,
  markRead: () => {},
  toggleRead: () => {},
  toggleArchived: () => {},
  markAllRead: () => {},
  archiveAllRead: () => {},
}

const Context = createContext<StaffNotifications>(NONE)

/** The signed-in member's notifications, for the rail, list pane and inbox. */
export function useStaffNotifications(): StaffNotifications {
  return useContext(Context)
}

function NovuFeed({ role, children }: { role: StaffRole; children: ReactNode }) {
  const [view, setView] = useState<NotificationView>("inbox")
  const { notifications = [], isLoading, readAll, archiveAllRead } = useNotifications({
    archived: view === "archived",
  })
  const { counts } = useCounts({ filters: [{ read: false, archived: false }] })

  const value = useMemo<StaffNotifications>(() => {
    // The mutations live on Novu's own objects, which keep its lists and
    // counts in step -- archiving one drops it from the inbox view at once.
    const withNotification = (id: string, act: (n: (typeof notifications)[number]) => unknown) => {
      const notification = notifications.find((candidate) => candidate.id === id)
      if (notification !== undefined) {
        void act(notification)
      }
    }

    return {
      loading: isLoading,
      view,
      setView,
      items: notifications.map((notification) => notificationItem(role, notification)),
      unread: counts?.[0]?.count ?? 0,
      markRead: (id) => withNotification(id, (n) => (n.isRead ? null : n.read())),
      toggleRead: (id) => withNotification(id, (n) => (n.isRead ? n.unread() : n.read())),
      toggleArchived: (id) =>
        withNotification(id, (n) => (n.isArchived ? n.unarchive() : n.archive())),
      markAllRead: () => void readAll(),
      archiveAllRead: () => void archiveAllRead(),
    }
  }, [role, view, notifications, isLoading, counts, readAll, archiveAllRead])

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
