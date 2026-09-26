import { describe, expect, it } from "vitest"

import { notificationItem, type InboxNotification } from "./notification-items"

function notification(overrides: Partial<InboxNotification> = {}): InboxNotification {
  return {
    id: "n-1",
    subject: "Quarterly Partner Forum has been assigned to you",
    body: "Quarterly Partner Forum for Test Organisation is now yours to review.",
    createdAt: "2026-09-26T16:20:00.000Z",
    isRead: false,
    redirect: { url: "/staff/coordinator/10" },
    tags: ["coordinator-assigned"],
    ...overrides,
  }
}

describe("notificationItem (SPM-174)", () => {
  it("opens the record a notification points at inside the inbox, so the list stays beside it", () => {
    expect(notificationItem("coordinator", notification()).href).toBe(
      "/staff/coordinator/notifications/10",
    )
  })

  it("leaves a redirect to one of the role's queues as it is, not as a record", () => {
    const item = notificationItem(
      "coordinator",
      notification({ redirect: { url: "/staff/coordinator/events" } }),
    )

    expect(item.href).toBe("/staff/coordinator/events")
  })

  it("leaves a redirect into another role's workspace as it is", () => {
    const item = notificationItem("coordinator", notification({ redirect: { url: "/staff/ops/10" } }))

    expect(item.href).toBe("/staff/ops/10")
  })

  it("stays on the inbox when a notification points nowhere", () => {
    const item = notificationItem("coordinator", notification({ redirect: undefined }))

    expect(item.href).toBe("/staff/coordinator/notifications")
  })

  it("is unread until Novu has it as read", () => {
    expect(notificationItem("coordinator", notification()).unread).toBe(true)
    expect(notificationItem("coordinator", notification({ isRead: true })).unread).toBe(false)
  })

  it("names the trigger it came from, by its workflow's tag", () => {
    expect(notificationItem("coordinator", notification()).status).toBe("Coordinator assigned")
  })

  it("shows no trigger for a workflow the inbox does not know yet", () => {
    const item = notificationItem("coordinator", notification({ tags: ["new-one"] }))

    expect(item.status).toBeUndefined()
  })

  it("titles a notification without a subject by its body", () => {
    const item = notificationItem("coordinator", notification({ subject: undefined }))

    expect(item.title).toBe(notification().body)
  })

  it("dates a notification by the Singapore calendar day it arrived", () => {
    // 16:20 UTC on the 26th is 00:20 on the 27th in Singapore.
    expect(notificationItem("coordinator", notification()).meta).toBe("27 Sept")
  })
})
