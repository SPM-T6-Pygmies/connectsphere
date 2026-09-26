"use client";

import { InboxIcon } from "lucide-react";

import { useStaffNotifications } from "@/components/staff-notifications";

import { QueueEmptyState } from "./queue-empty-state";

/** The inbox before a notification is opened: how many are unread (SPM-174). */
export function NotificationPlaceholder() {
  const { loading, items, unread } = useStaffNotifications();

  if (loading) {
    return null;
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
