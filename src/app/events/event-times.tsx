"use client";

import { useSyncExternalStore } from "react";

import type { TimeRangeOnDate } from "@/core/domain/event-times";

import { eventTimes, VENUE_TIME_ZONE } from "./format-event-time";

// The browser's timezone never changes under a page, so there is nothing to subscribe to.
const subscribe = () => () => {};
const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const venueTimeZone = () => VENUE_TIME_ZONE;

/**
 * An event's start and end times in the viewer's timezone (SPM-326).
 *
 * The server cannot know the viewer's timezone, so it renders venue time and
 * the browser swaps in its own once hydrated -- the same text for anyone in
 * Singapore, and named times for anyone else. An event with no times yet
 * reads "—".
 */
export function EventTimes({
  times,
  nameEveryDay = false,
}: {
  times: readonly TimeRangeOnDate[];
  nameEveryDay?: boolean;
}) {
  const timeZone = useSyncExternalStore(subscribe, viewerTimeZone, venueTimeZone);
  return <>{times.length === 0 ? "—" : eventTimes(times, timeZone, nameEveryDay)}</>;
}
