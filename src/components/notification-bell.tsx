"use client"

import { Inbox } from "@novu/nextjs"

const APPLICATION_IDENTIFIER = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER

/**
 * The member of staff's notifications, as Novu's Inbox (SPM-174).
 *
 * Read/unread state is Novu's own (SPM-57 AC6). The app-router `Inbox`
 * passes a notification's redirect to `next/navigation`, so opening one
 * navigates in-app rather than reloading (AC5). The colours are the app's
 * own tokens, so the popover follows light and dark mode with the rest.
 *
 * Renders nothing until Novu is configured for the environment.
 */
export function NotificationBell({
  subscriberId,
  subscriberHash,
}: {
  subscriberId: string
  subscriberHash: string
}) {
  if (!APPLICATION_IDENTIFIER) {
    return null
  }

  return (
    <Inbox
      applicationIdentifier={APPLICATION_IDENTIFIER}
      subscriberId={subscriberId}
      subscriberHash={subscriberHash}
      appearance={{
        variables: {
          colorBackground: "var(--popover)",
          colorForeground: "var(--foreground)",
          colorPrimary: "var(--primary)",
          colorPrimaryForeground: "var(--primary-foreground)",
          colorSecondaryForeground: "var(--muted-foreground)",
          colorNeutral: "var(--border)",
          borderRadius: "var(--radius)",
        },
        // Novu's popover is a fixed 400px, wider than a phone.
        elements: { popoverContent: "max-w-[calc(100vw-2rem)]" },
      }}
    />
  )
}
