"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Venue } from "@/core/use-cases/view-venue-booking-options";

import {
  changeBookingRoomLayoutAction,
  type ChangeBookingRoomLayoutState,
} from "./actions";

const INITIAL: ChangeBookingRoomLayoutState = { status: "idle" };

const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3";

/**
 * SPM-104: move a pending request to another layout of the same venue. Offered
 * only while the request is waiting for Venue Staff, and only when the venue
 * has another layout to move to. The server makes every call; this only keeps
 * the button honest.
 */
export function ChangeLayoutForm({
  eventId,
  eventRequestId,
  bookingId,
  venue,
  currentLayout,
}: {
  eventId: string;
  eventRequestId: string;
  bookingId: string;
  venue: Venue;
  currentLayout: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    changeBookingRoomLayoutAction,
    INITIAL,
  );
  const [layout, setLayout] = useState(currentLayout ?? "");
  const selectId = useId();

  if (venue.layouts.length < 2) {
    return null;
  }

  const unchanged = layout === "" || layout === currentLayout;

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventRequestId" value={eventRequestId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          Change layout for the booking at {venue.location}
        </label>
        <select
          id={selectId}
          name="roomLayout"
          value={layout}
          onChange={(change) => setLayout(change.target.value)}
          className={SELECT_CLASS}
          disabled={pending}
        >
          {currentLayout === null ? (
            <option value="">Choose a layout</option>
          ) : null}
          {venue.layouts.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name} (holds {option.capacity})
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={unchanged || pending}
        >
          {pending ? "Saving…" : "Change layout"}
        </Button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-xs">
          {state.message}
        </p>
      ) : null}
      {state.status === "changed" && state.bookingId === bookingId ? (
        <p role="status" className="text-muted-foreground text-xs">
          Layout changed. {state.summary}
        </p>
      ) : null}
    </form>
  );
}
