"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { pollWhileVisible } from "./poll-while-visible";

/**
 * How long a message may sit unseen on the other side's screen. Short enough
 * that a conversation does not feel one-sided, long enough that an idle detail
 * page is not a load-bearing cost.
 */
const INTERVAL_MS = 15_000;

/**
 * Keeps an open clarification thread current while someone else is writing on
 * it (SPM-33 AC4-AC5 read from two sides at once).
 *
 * `router.refresh()` rather than a client-side fetch: the thread is read by a
 * Server Component through `eventRequestAccessFor`, and re-rendering that tree
 * keeps the access check exactly where it already is. `event_request_comment`
 * has RLS with no policies and is reached only through `security definer`
 * functions, so subscribing to the table from the browser would mean opening
 * it to the client -- a live feed is not worth that trade here.
 *
 * A refresh reconciles rather than remounts, so a half-typed reply, its focus
 * and the scroll position all survive one.
 */
export function ThreadRefresher() {
  const router = useRouter();

  useEffect(
    () =>
      pollWhileVisible({
        intervalMs: INTERVAL_MS,
        onTick: () => router.refresh(),
        visibility: document,
      }),
    [router],
  );

  return null;
}
