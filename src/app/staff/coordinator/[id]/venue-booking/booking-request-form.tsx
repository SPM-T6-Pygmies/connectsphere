"use client";

import { CircleAlert, CircleCheck, PlusIcon, XIcon } from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkLayoutCapacity, gridTimes } from "@/core/domain/booking";
import type { Venue } from "@/core/use-cases/view-venue-booking-options";

import {
  submitVenueBookingRequestAction,
  type SubmitVenueBookingRequestState,
} from "./actions";
import { describeCapacity } from "../../../booking-capacity-message";

const INITIAL: SubmitVenueBookingRequestState = { status: "idle" };

const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3";

interface DateRow {
  readonly key: number;
  readonly date: string;
  readonly start: string;
  readonly end: string;
}

/** Without opening hours on record the grid covers the whole day. */
function timesFor(venue: Venue | undefined): string[] {
  return gridTimes(
    venue?.operatingHoursStart ?? "00:00",
    venue?.operatingHoursEnd ?? "24:00",
  );
}

function venueMeta(venue: Venue): string {
  return [
    venue.capacity === null ? null : `holds ${venue.capacity}`,
    venue.facilities,
    venue.accessibility,
  ]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
}

/** A single-layout venue takes its only layout, so there is nothing to pick. */
function defaultLayout(venue: Venue | undefined): string {
  return venue?.layouts.length === 1 ? venue.layouts[0].name : "";
}

function TimeSelect({
  label,
  value,
  times,
  onChange,
}: {
  label: string;
  value: string;
  times: readonly string[];
  onChange: (time: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(change) => onChange(change.target.value)}
      className={SELECT_CLASS.replace("w-full", "w-auto")}
    >
      <option value="">--:--</option>
      {times.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}

/**
 * SPM-46 / SPM-104: one venue, its layout, and a start and end time, on the
 * quarter hour and within the venue's hours, on one or more days. Every field is held in state, so a refused request keeps what
 * was chosen. The server decides everything -- a clash, a missing layout --
 * and this only keeps the Submit button honest.
 */
export function BookingRequestForm({
  eventId,
  eventRequestId,
  defaultDate,
  expectedAttendance,
  venues,
}: {
  eventId: string;
  eventRequestId: string;
  defaultDate: string | null;
  /** The event's expected attendance, for the capacity hint under the layout. */
  expectedAttendance: number | null;
  venues: readonly Venue[];
}) {
  const [state, formAction, pending] = useActionState(
    submitVenueBookingRequestAction,
    INITIAL,
  );
  const idPrefix = useId();

  const [venueId, setVenueId] = useState("");
  const [layout, setLayout] = useState("");
  const [nextKey, setNextKey] = useState(1);
  const [rows, setRows] = useState<readonly DateRow[]>([
    { key: 0, date: defaultDate ?? "", start: "", end: "" },
  ]);

  // A sent request starts the form afresh -- its row is in the list below now.
  // Adjusted while rendering rather than in an effect, so the cleared form is
  // the first thing painted after the success.
  const [clearedFor, setClearedFor] = useState<string | null>(null);
  if (state.status === "submitted" && state.bookingId !== clearedFor) {
    setClearedFor(state.bookingId);
    setVenueId("");
    setLayout("");
    setRows([{ key: 0, date: defaultDate ?? "", start: "", end: "" }]);
    setNextKey(1);
  }

  const venue = venues.find((candidate) => candidate.id === venueId);
  const needsLayoutChoice = (venue?.layouts.length ?? 0) > 1;
  const times = timesFor(venue);
  // Only once a layout is chosen: until then there is no figure to compare.
  const capacityHint =
    venue !== undefined && layout !== ""
      ? describeCapacity(checkLayoutCapacity(venue, layout, expectedAttendance))
      : null;
  const chosenSlots = rows.flatMap((row) =>
    row.date === "" || row.start === "" || row.end === ""
      ? []
      : [`${row.date}|${row.start}|${row.end}`],
  );
  const canSubmit =
    venue !== undefined &&
    chosenSlots.length > 0 &&
    (!needsLayoutChoice || layout !== "");

  function chooseVenue(id: string) {
    setVenueId(id);
    setLayout(defaultLayout(venues.find((candidate) => candidate.id === id)));
  }

  function updateRow(key: number, change: Partial<Omit<DateRow, "key">>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey, date: "", start: "", end: "" },
    ]);
    setNextKey((key) => key + 1);
  }

  if (venues.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
        No venues are on record yet. Venue Staff add them to the catalogue.
      </p>
    );
  }

  return (
    <form
      // Submitted by hand rather than through `action`: React resets a form
      // after its action runs, and that reset reaches the DOM of these
      // controlled fields too -- a refused request would then show an empty
      // venue picker over the layout choice still held in state.
      onSubmit={(submit) => {
        submit.preventDefault();
        const formData = new FormData(submit.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-5"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventRequestId" value={eventRequestId} />
      <input type="hidden" name="roomLayout" value={layout} />
      {chosenSlots.map((value, index) => (
        // Keyed by position: two rows on the same day can overlap, and the
        // server, not a duplicate-key collision here, should refuse that.
        <input
          key={`${index}-${value}`}
          type="hidden"
          name="slot"
          value={value}
        />
      ))}

      <fieldset className="space-y-5" disabled={pending}>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-venue`}>Venue</Label>
          <select
            id={`${idPrefix}-venue`}
            name="venueId"
            value={venueId}
            onChange={(change) => chooseVenue(change.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Choose a venue</option>
            {venues.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.location}
              </option>
            ))}
          </select>
          {venue ? (
            <p className="text-muted-foreground text-xs">{venueMeta(venue)}</p>
          ) : null}
        </div>

        {venue ? (
          <div className="space-y-2">
            <p className="text-sm font-medium" id={`${idPrefix}-layout`}>
              Room layout
            </p>
            {venue.layouts.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                This venue has no layouts on record, so there is none to choose.
              </p>
            ) : venue.layouts.length === 1 ? (
              <p className="text-muted-foreground text-xs">
                {venue.layouts[0].name} (holds {venue.layouts[0].capacity}) —
                the only layout this venue supports.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby={`${idPrefix}-layout`}
                className="grid gap-2 sm:grid-cols-2"
              >
                {venue.layouts.map((option) => (
                  <label
                    key={option.name}
                    className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                  >
                    <input
                      type="radio"
                      name={`${idPrefix}-layout-choice`}
                      value={option.name}
                      checked={layout === option.name}
                      onChange={() => setLayout(option.name)}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{option.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · holds {option.capacity}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {capacityHint ? (
              <p
                role="status"
                className={
                  capacityHint.tone === "over"
                    ? "text-destructive text-xs font-medium"
                    : "text-muted-foreground text-xs"
                }
              >
                {capacityHint.text}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">Dates and times</p>
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3"
            >
              <Label
                htmlFor={`${idPrefix}-date-${row.key}`}
                className="sr-only"
              >
                Date {index + 1}
              </Label>
              <Input
                id={`${idPrefix}-date-${row.key}`}
                type="date"
                value={row.date}
                onChange={(change) =>
                  updateRow(row.key, { date: change.target.value })
                }
                className="w-auto"
              />
              <TimeSelect
                label={`Start time, date ${index + 1}`}
                value={row.start}
                times={times.slice(0, -1)}
                onChange={(start) => updateRow(row.key, { start })}
              />
              <span aria-hidden>to</span>
              <TimeSelect
                label={`End time, date ${index + 1}`}
                value={row.end}
                times={times.filter(
                  (time) => row.start === "" || time > row.start,
                )}
                onChange={(end) => updateRow(row.key, { end })}
              />
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    setRows((current) =>
                      current.filter((r) => r.key !== row.key),
                    )
                  }
                  aria-label={`Remove date ${index + 1}`}
                >
                  <XIcon aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <PlusIcon aria-hidden />
            Add another date
          </Button>
        </div>
      </fieldset>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      {state.status === "submitted" ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertTitle>
            Booking request sent for {state.venueLocation}. Venue Staff will
            review it.
          </AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={!canSubmit || pending}>
        {pending ? "Sending…" : "Send booking request"}
      </Button>
    </form>
  );
}
