"use client";

import { ArchiveIcon, InboxIcon } from "lucide-react";

import { useStaffNotifications } from "@/components/staff-notifications";

import { QueueEmptyState } from "./queue-empty-state";

/** The inbox before a notification is opened: how many are unread (SPM-174). */
export function NotificationPlaceholder() {
  const { loading, view, items, unread } = useStaffNotifications();

  if (loading) {
    return null;
  }

  if (view === "archived") {
    return (
      <QueueEmptyState
        icon={ArchiveIcon}
        title={`${items.length} archived notification${items.length === 1 ? "" : "s"}`}
      />
    );
  }

  return (
    <QueueEmptyState
      icon={InboxIcon}
      title={
        items.length === 0
          ? "No notifications"
          : `${unread} unread notification${unread === 1 ? "" : "s"}`
      }
      description={items.length === 0 ? "Notifications about your events will arrive here." : undefined}
    />
  );
}
