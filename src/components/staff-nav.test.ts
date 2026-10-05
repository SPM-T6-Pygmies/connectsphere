import { describe, expect, it } from "vitest"

import { currentSection, railItems, resolveQueue } from "./staff-nav"

describe("Safety Officer navigation (SPM-258)", () => {
  it("gives the Safety Officer their own rail: the check list and their inbox", () => {
    expect(railItems("safety").map(({ title, url }) => ({ title, url }))).toEqual([
      { title: "Awaiting check", url: "/staff/safety" },
      { title: "Notifications", url: "/staff/safety/notifications" },
    ])
  })

  it("links nowhere outside the safety workspace", () => {
    expect(railItems("safety").every(({ url }) => url.startsWith("/staff/safety"))).toBe(true)
  })

  it.each([
    ["/staff/safety", "awaitingCheck"],
    ["/staff/safety/notifications", "notifications"],
  ] as const)("marks %s as the %s section", (pathname, section) => {
    expect(currentSection("safety", pathname)).toBe(section)
  })

  it("heads the list Awaiting check, with nothing in it until events can reach the check", () => {
    expect(resolveQueue({ role: "safety", pathname: "/staff/safety" })).toEqual({
      section: "awaitingCheck",
      heading: "Awaiting check",
      items: [],
    })
  })
})
