"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { timeSpans } from "@/core/domain/booking-review-flag";
import { joinSlotCodes } from "@/core/domain/slot-grid";
import type { VenueUnavailabilityEntry } from "@/core/domain/venue-unavailability";
import { closedPeriods, formatOpeningHours, type OpeningWindow } from "@/core/domain/opening-hours";
import { END_OF_DAY, formatRange, fromMinutes, GRID_MINUTES, toMinutes } from "@/core/domain/time-of-day";
import { UNAVAILABILITY_NOTE_MAX_LENGTH, UNAVAILABILITY_REASONS } from "@/core/domain/venue-unavailability";

import { OptionSelect } from "../../option-fields";
import { recordUnavailabilityAction, type RecordUnavailabilityState } from "./actions";

const INITIAL: RecordUnavailabilityState = { status: "idle" };

function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

const SELECT_CLASS =
  "border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-base disabled:opacity-50 md:text-sm";

/** Every 15-minute time from `first` to `last`, as minutes after midnight. */
function gridTimes(first: number, last: number): number[] {
  return Array.from({ length: (last - first) / GRID_MINUTES + 1 }, (_, i) => first + i * GRID_MINUTES);
}

/**
 * A time the venue is open at, picked from its 15-minute grid (SPM-321 AC3a). A time that
 * cannot be picked is listed with the reason, so Venue Staff see why it is missing. `whyNot`
 * uses the same `closedPeriods` rule the server applies; the server refuses closed time regardless.
 */
function TimeSelect({
  id,
  label,
  value,
  onChange,
  times,
  whyNot,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  times: readonly number[];
  /** Why a time cannot be picked, or null when it can. */
  whyNot: (minutes: number) => string | null;
}) {
  return (
    <>
      <input type="hidden" name={id} value={value} />
      <select
        id={id}
        aria-label={label}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Choose a time</option>
        {times.map((minutes) => {
          const why = whyNot(minutes);
          return (
            <option key={minutes} value={fromMinutes(minutes)} disabled={why !== null}>
              {fromMinutes(minutes)}
              {why === null ? "" : ` (${why})`}
            </option>
          );
        })}
      </select>
    </>
  );
}

/**
 * The "Mark unavailable" form (SPM-21, SPM-321). The same start and end time apply to every
 * day from the start date to the end date, within the chosen venue's opening hours. The
 * submit button waits for the fields that are always needed; whether the dates make sense,
 * and whether a note belongs under the reason, are the domain's call and come back as a
 * message. After a save, the bookings the block sits over are listed, read-only.
 */
export function UnavailabilityForm({
  venues,
  defaultVenueId,
}: {
  venues: ReadonlyArray<{ id: string; location: string; openingHours: readonly OpeningWindow[] }>;
  defaultVenueId?: string;
}) {
  const [state, formAction, pending] = useActionState(recordUnavailabilityAction, INITIAL);

  useEffect(() => {
    if (state.status === "saved") {
      toast.success("Venue marked unavailable.");
    }
  }, [state]);

  return (
    <div className="space-y-6">
      {state.status === "saved" ? <Saved entry={state.entry} /> : null}
      {/* A new key after a save gives an empty form, so a saved block is not one click from being saved again. */}
      <BlockForm
        key={state.status === "saved" ? state.entry.id : "draft"}
        venues={venues}
        defaultVenueId={defaultVenueId}
        state={state}
        formAction={formAction}
        pending={pending}
      />
      {state.status === "saved" ? <AffectedBookings state={state} /> : null}
    </div>
  );
}

/** What was just saved, in the words the list below uses, so the empty form is not mistaken for a failure. */
function Saved({ entry }: { entry: VenueUnavailabilityEntry }) {
  const first = entry.slots.map(({ date }) => date).sort()[0];
  const times = joinSlotCodes(entry.slots.filter(({ date }) => date === first).map(({ slot }) => slot))
    .map(formatRange)
    .join(", ");
  const dates = entry.startDate === entry.endDate ? entry.startDate : `${entry.startDate} to ${entry.endDate}`;
  return (
    <p
      role="status"
      className="rounded-lg border border-green-600/40 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/30 dark:text-green-200"
    >
      <span className="font-medium">Saved.</span> {entry.venueLocation} is blocked {dates}, {times}, for{" "}
      {entry.reason.toLowerCase()}. It is In force and listed below.
    </p>
  );
}

function BlockForm({
  venues,
  defaultVenueId,
  state,
  formAction,
  pending,
}: {
  venues: ReadonlyArray<{ id: string; location: string; openingHours: readonly OpeningWindow[] }>;
  defaultVenueId?: string;
  state: RecordUnavailabilityState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const [venueId, setVenueId] = useState(
    venues.some((venue) => venue.id === defaultVenueId) ? (defaultVenueId ?? "") : "",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const readyToSubmit = [venueId, startDate, endDate, startTime, endTime, reason].every(isFilled);

  const openingHours = venues.find((venue) => venue.id === venueId)?.openingHours ?? [];
  const start = toMinutes(startTime);
  // A start can be picked when the venue is open for the quarter hour after it.
  const whyNotStart = (minutes: number) =>
    closedPeriods(openingHours, { start: minutes, end: minutes + GRID_MINUTES }).length === 0 ? null : "closed";
  // An end can be picked when it is after the start and the venue is open all the way between them;
  // with no start yet, when the venue is open for the quarter hour before it.
  const whyNotEnd = (minutes: number) => {
    if (start === null) {
      return closedPeriods(openingHours, { start: minutes - GRID_MINUTES, end: minutes }).length === 0 ? null : "closed";
    }
    if (minutes <= start) {
      return "not after the start";
    }
    return closedPeriods(openingHours, { start, end: minutes }).length === 0 ? null : "closed in between";
  };

  function chooseVenue(next: string) {
    setVenueId(next);
    setStartTime("");
    setEndTime("");
  }

  return (
    <>
      {/* Submitted by hand, not through `action`: React resets a form once its action finishes,
          which blanks the selects after a refusal while their state still holds the values. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="space-y-6"
      >
        {state.status === "error" ? (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            {state.message}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Mark unavailable</CardTitle>
            <CardDescription>
              Coordinators cannot request these times while the block is in force. Existing
              bookings are not changed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="venueId">
                Venue <span className="text-destructive">*</span>
              </Label>
              <select
                id="venueId"
                name="venueId"
                required
                value={venueId}
                onChange={(event) => chooseVenue(event.target.value)}
                className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-base md:text-sm"
              >
                <option value="">Choose a venue</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.location}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="startDate">
                From <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">
                To <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                required
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="startTime">
                Start time, on every day in the range <span className="text-destructive">*</span>
              </Label>
              <TimeSelect
                id="startTime"
                label="Start time"
                value={startTime}
                onChange={(next) => {
                  setStartTime(next);
                  setEndTime("");
                }}
                times={gridTimes(0, END_OF_DAY - GRID_MINUTES)}
                whyNot={whyNotStart}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">
                End time <span className="text-destructive">*</span>
              </Label>
              <TimeSelect
                id="endTime"
                label="End time"
                value={endTime}
                onChange={setEndTime}
                times={gridTimes(GRID_MINUTES, END_OF_DAY)}
                whyNot={whyNotEnd}
              />
            </div>
            <p className="text-muted-foreground text-xs sm:col-span-2">
              {venueId === ""
                ? "Choose a venue to see its opening hours."
                : `Opening hours: ${formatOpeningHours(openingHours)}. A block can only cover time the venue is open.`}
            </p>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <OptionSelect
                id="reason"
                name="reason"
                options={UNAVAILABILITY_REASONS}
                value={reason}
                onChange={setReason}
                blank="Choose a reason"
                required
              />
            </div>

            {reason === "Other" ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  name="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What is happening?"
                />
                <p className="text-muted-foreground text-xs">
                  {Array.from(note).length} / {UNAVAILABILITY_NOTE_MAX_LENGTH}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Button type="submit" disabled={!readyToSubmit || pending}>
          {pending ? "Saving…" : "Mark unavailable"}
        </Button>
      </form>
    </>
  );
}

/** AC11: what the block sits over, read-only, or that nothing is affected. */
function AffectedBookings({ state }: { state: Extract<RecordUnavailabilityState, { status: "saved" }> }) {
  const { affectedBookings, entry } = state;
  // One line per booking, its days and hours joined as a person reads them (AC4).
  const bookings = [...Map.groupBy(affectedBookings, (booking) => booking.bookingId).values()].map((rows) => ({
    bookingId: rows[0].bookingId,
    eventName: rows[0].eventName,
    status: rows[0].status,
    slots: rows,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings this block overlaps</CardTitle>
        <CardDescription>
          {entry.venueLocation} is now blocked. These bookings and their events are unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-sm">No bookings are affected.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {bookings.map((booking) => (
              <li key={booking.bookingId}>
                <span className="font-medium">{booking.eventName}</span> · {timeSpans(booking.slots)} · {booking.status}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
