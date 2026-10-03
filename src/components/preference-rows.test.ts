import { describe, expect, it } from "vitest"

import { preferenceRows, type InboxPreference } from "./preference-rows"

function preference(overrides: Partial<InboxPreference> = {}): InboxPreference {
  return {
    level: "template",
    channels: { in_app: true },
    workflow: { id: "wf-1", identifier: "coordinator-assigned", name: "Coordinator assigned", critical: false },
    ...overrides,
  }
}

describe("preferenceRows (SPM-180)", () => {
  it("lists one row per notification type, named for people", () => {
    expect(preferenceRows([preference()])).toEqual([
      {
        workflowId: "wf-1",
        name: "Coordinator assigned",
        locked: false,
        channels: [{ channel: "in_app", label: "In-app", enabled: true }],
      },
    ])
  })

  it("leaves out the all-notifications default, which is not a type", () => {
    expect(preferenceRows([preference({ level: "global", workflow: undefined })])).toEqual([])
  })

  it("locks a type Novu marks critical, so it cannot be switched off", () => {
    const [row] = preferenceRows([
      preference({ workflow: { ...preference().workflow!, critical: true } }),
    ])

    expect(row?.locked).toBe(true)
  })

  it("shows only the channels a type actually delivers on, in-app first", () => {
    const [row] = preferenceRows([preference({ channels: { email: false, in_app: true } })])

    expect(row?.channels).toEqual([
      { channel: "in_app", label: "In-app", enabled: true },
      { channel: "email", label: "Email", enabled: false },
    ])
  })
})
