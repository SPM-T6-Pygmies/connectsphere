"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingSlotValue } from "@/core/domain/booking";
import type { VenueOption } from "@/core/ports/outbound/venue-repository";
import type { SubmitVenueBookingRequestResult } from "@/core/use-cases/submit-venue-booking-request";

import { submitVenueBookingRequestAction, type SubmitVenueBookingRequestState } from "./actions";

const INITIAL: SubmitVenueBookingRequestState = { status: "idle" };

/** Mirrors `Input`'s own styling -- this repo has no `<select>` primitive yet, so a native one borrows it. */
const SELECT_CLASSES =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

interface SlotRow {
  readonly id: string;
  readonly slotDate: string;
  readonly am: boolean;
  readonly pm: boolean;
  readonly night: boolean;
}

function emptyRow(id: string): SlotRow {
  return { id, slotDate: "", am: false, pm: false, night: false };
}

function slotsFrom(rows: readonly SlotRow[]): { slotDate: string; slot: BookingSlotValue }[] {
  return rows.flatMap((row) => {
    if (row.slotDate.length === 0) {
      return [];
    }
    const picked: { slotDate: string; slot: BookingSlotValue }[] = [];
    if (row.am) picked.push({ slotDate: row.slotDate, slot: "AM" });
    if (row.pm) picked.push({ slotDate: row.slotDate, slot: "PM" });
    if (row.night) picked.push({ slotDate: row.slotDate, slot: "Night" });
    return picked;
  });
}

/** SPM-46: names a venue, its layout, and one or more AM/PM/Night slots per day. */
export function BookVenueForm({ eventId, venues }: { eventId: string; venues: readonly VenueOption[] }) {
  const [state, formAction, pending] = useActionState(submitVenueBookingRequestAction, INITIAL);
  const [venueId, setVenueId] = useState("");
  const [roomLayoutId, setRoomLayoutId] = useState("");
  const [rows, setRows] = useState<readonly SlotRow[]>(() => [emptyRow("row-1")]);
  // A ref, not a module-level counter: mutating it happens only inside the
  // "Add another day" click handler, never during render -- Strict Mode's
  // double-invocation of renders would otherwise burn ids and leave the
  // rendered row's own id unpredictable.
  const nextRowId = useRef(2);

  if (state.status === "submitted") {
    return <Acknowledgement result={state.result} />;
  }

  const selectedVenue = venues.find((venue) => venue.id === venueId) ?? null;
  const layouts = selectedVenue?.supportedLayouts ?? [];
  const slots = slotsFrom(rows);

  function updateRow(id: string, patch: Partial<Omit<SlotRow, "id">>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="roomLayoutId" value={roomLayoutId} />
      <input type="hidden" name="slotsJson" value={JSON.stringify(slots)} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Venue and layout</CardTitle>
          <CardDescription>
            Each venue&apos;s supported layouts are shown with the capacity that applies to that layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="venue-select">
              Venue<span className="text-destructive" aria-label="required">*</span>
            </Label>
            <select
              id="venue-select"
              className={SELECT_CLASSES}
              value={venueId}
              onChange={(event) => {
                setVenueId(event.target.value);
                setRoomLayoutId("");
              }}
            >
              <option value="">Choose a venue…</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.location}
                  {venue.capacity !== null ? ` (up to ${venue.capacity})` : ""}
                </option>
              ))}
            </select>
            {state.status === "error" ? (
              <p className="text-destructive text-xs">{state.fieldErrors?.venueId?.[0]}</p>
            ) : null}
          </div>

          {layouts.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="layout-select">
                Room layout
                {layouts.length > 1 ? (
                  <span className="text-destructive" aria-label="required">
                    *
                  </span>
                ) : null}
              </Label>
              <select
                id="layout-select"
                className={SELECT_CLASSES}
                value={roomLayoutId}
                onChange={(event) => setRoomLayoutId(event.target.value)}
              >
                <option value="">
                  {layouts.length > 1
                    ? "Choose a layout…"
                    : `${layouts[0]!.name} (the only layout this venue supports)`}
                </option>
                {layouts.map((layout) => (
                  <option key={layout.roomLayoutId} value={layout.roomLayoutId}>
                    {layout.name}
                    {layout.capacity !== null ? ` — capacity ${layout.capacity}` : ""}
                  </option>
                ))}
              </select>
              {state.status === "error" ? (
                <p className="text-destructive text-xs">{state.fieldErrors?.roomLayoutId?.[0]}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slots</CardTitle>
          <CardDescription>
            Pick one or more AM/PM/Night slots per day this event needs the venue. Submitting is blocked outright
            if the venue already has a confirmed booking for any slot named here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label htmlFor={`date-${row.id}`}>Date</Label>
                <Input
                  id={`date-${row.id}`}
                  type="date"
                  value={row.slotDate}
                  onChange={(event) => updateRow(row.id, { slotDate: event.target.value })}
                />
              </div>
              {(
                [
                  ["am", "AM"],
                  ["pm", "PM"],
                  ["night", "Night"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={row[key]}
                    onChange={(event) => updateRow(row.id, { [key]: event.target.checked })}
                  />
                  {label}
                </label>
              ))}
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((current) => current.filter((candidate) => candidate.id !== row.id))}
                >
                  Remove day
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const row = emptyRow(`row-${nextRowId.current}`);
              nextRowId.current += 1;
              setRows((current) => [...current, row]);
            }}
          >
            Add another day
          </Button>
          {state.status === "error" ? (
            <p className="text-destructive text-xs">{state.fieldErrors?.slots?.[0]}</p>
          ) : null}
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        Submit booking request
      </Button>
    </form>
  );
}

/** SPM-46 AC1-3: the request as it now stands, read back from what was stored -- nothing editable survives submission. */
function Acknowledgement({ result }: { result: SubmitVenueBookingRequestResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking request submitted</CardTitle>
        <CardDescription>Status: {result.status}. Venue Staff will review this request.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">Venue</p>
          <p className="text-muted-foreground text-sm">
            {result.venueLocation}
            {result.roomLayoutName ? ` — ${result.roomLayoutName}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Slots</p>
          <ul className="text-muted-foreground text-sm">
            {result.slots.map((slot) => (
              <li key={`${slot.slotDate}-${slot.slot}`}>
                {slot.slotDate} · {slot.slot}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
