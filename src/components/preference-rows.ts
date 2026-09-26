/** The part of a Novu preference the preferences sheet shows. */
export interface InboxPreference {
  readonly level: string
  readonly channels: Readonly<Partial<Record<Channel, boolean>>>
  readonly workflow?: {
    readonly id: string
    readonly identifier: string
    readonly name: string
    readonly critical: boolean
  }
}

type Channel = "in_app" | "email" | "sms" | "push" | "chat"

/** The channels the sheet knows, in the order it lists them. */
const CHANNELS: readonly { channel: Channel; label: string }[] = [
  { channel: "in_app", label: "In-app" },
  { channel: "email", label: "Email" },
  { channel: "push", label: "Push" },
  { channel: "sms", label: "SMS" },
  { channel: "chat", label: "Chat" },
]

export interface PreferenceRow {
  readonly workflowId: string
  readonly name: string
  /** Novu's "critical": the workflow declared its preferences read-only. */
  readonly locked: boolean
  readonly channels: readonly { channel: Channel; label: string; enabled: boolean }[]
}

/**
 * One row per notification type the member can receive, with a switch per
 * channel that type delivers on (SPM-180). A channel appears only once a
 * workflow has a step for it -- email shows up by itself when one is added.
 */
export function preferenceRows(preferences: readonly InboxPreference[]): PreferenceRow[] {
  return preferences.flatMap((preference) => {
    const { workflow } = preference
    if (preference.level !== "template" || workflow === undefined) {
      return []
    }

    return [
      {
        workflowId: workflow.id,
        name: workflow.name,
        locked: workflow.critical,
        channels: CHANNELS.flatMap(({ channel, label }) => {
          const enabled = preference.channels[channel]
          return enabled === undefined ? [] : [{ channel, label, enabled }]
        }),
      },
    ]
  })
}
