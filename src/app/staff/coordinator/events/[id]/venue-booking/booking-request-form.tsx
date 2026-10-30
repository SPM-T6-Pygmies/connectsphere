"use client";

import { CircleAlert, CircleCheck, PlusIcon, XIcon } from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TimeRangeOnDate } from "@/core/domain/event-times";
import { describeBuffers } from "@/core/domain/venue-buffers";
import type { Venue, VenueLayoutSuitability } from "@/core/use-cases/view-venue-booking-options";

import { submitVenueBookingRequestAction, type SubmitVenueBookingRequestState } from "./actions";
import { SuitabilityChecklist } from "../../../../suitability-checklist";
import { TimePicker } from "../../../../time-picker";

const INITIAL: SubmitVenueBookingRequestState = { status: "idle" };

const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3";

interface DateRow {
  readonly key: number;
  readonly date: string;
  /** `HH:MM`, or empty until picked. */
  readonly start: string;
  readonly end: string;
}

function venueMeta(venue: Venue): string {
  return [
    venue.capacity === null ? null : `holds ${venue.capacity}`,
    describeBuffers(venue),
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

/**
 * SPM-46 / SPM-104 / SPM-324: one venue, its layout, and a start and end time
 * on each of one or more dates, on the 15-minute grid. SPM-45: once the venue (and its layout) is chosen, a checklist says
 * whether it fits the event's needs -- advice only, the request can still be sent. Every field is held in state, so a refused request keeps what
 * was chosen. The server decides everything -- a clash, a missing layout --
 * and this only keeps the Submit button honest.
 *
 * SPM-251: a re-request is this form, started from what the server worked out
 * and naming the flagged booking it replaces. Once sent, that booking has a
 * re-request waiting, so the page swaps back to the ordinary form; the
 * confirmation is a toast, which outlives the swap.
 */
export function BookingRequestForm({
  initialVenueId,
  initialLayout,
  initialTimes,
  replacesBookingId,
  eventId,
  defaultDate,
  venues,
  suitability,
}: {
  /** SPM-62 AC3: the venue Venue Staff suggested, when the coordinator chose to request it. */
  initialVenueId?: string;
  /** SPM-251 AC2: a re-request starts from these; otherwise the venue's only layout and one blank date. */
  initialLayout?: string | null;
  initialTimes?: readonly TimeRangeOnDate[];
  /** SPM-251: the flagged booking this re-request replaces. */
  replacesBookingId?: string;
  eventId: string;
  defaultDate: string | null;
  venues: readonly Venue[];
  /** The server's verdict for each venue and layout, worked out from the event's needs now. */
  suitability: readonly VenueLayoutSuitability[];
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: SubmitVenueBookingRequestState, formData: FormData) => {
      const next = await submitVenueBookingRequestAction(previous, formData);
      if (next.status === "submitted" && next.replacingVenueLocation !== null) {
        toast.success(
          `Re-request sent for ${next.venueLocation}. Venue Staff will review it. The booking at ${next.replacingVenueLocation} stays until they approve it.`,
        );
      }
      return next;
    },
    INITIAL,
  );
  const idPrefix = useId();

  const [venueId, setVenueId] = useState(initialVenueId ?? "");
  const [layout, setLayout] = useState(
    () => initialLayout ?? defaultLayout(venues.find((candidate) => candidate.id === initialVenueId)),
  );
  const [nextKey, setNextKey] = useState(Math.max(initialTimes?.length ?? 0, 1));
  const [rows, setRows] = useState<readonly DateRow[]>(() =>
    initialTimes !== undefined && initialTimes.length > 0
      ? initialTimes.map((time, key) => ({ key, ...time }))
      : [{ key: 0, date: defaultDate ?? "", start: "", end: "" }],
  );

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
  // Once the venue is chosen, and its layout if it has several (AC3).
  const verdict =
    venue !== undefined && (!needsLayoutChoice || layout !== "")
      ? suitability.find(
          (entry) => entry.venueId === venue.id && entry.layout === (layout === "" ? null : layout),
        )?.suitability
      : undefined;
  // A missing date or time is the server's to name (SPM-324 AC1).
  const canSubmit = venue !== undefined && (!needsLayoutChoice || layout !== "");

  function chooseVenue(id: string) {
    setVenueId(id);
    setLayout(defaultLayout(venues.find((candidate) => candidate.id === id)));
  }

  function updateRow(key: number, change: Partial<Omit<DateRow, "key">>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey, date: "", start: "", end: "" }]);
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
      <input type="hidden" name="roomLayout" value={layout} />
      <input type="hidden" name="replacesBookingId" value={replacesBookingId ?? ""} />

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
                {venue.layouts[0].name} (holds {venue.layouts[0].capacity}) — the only layout this
                venue supports.
              </p>
            ) : (
              <div role="radiogroup" aria-labelledby={`${idPrefix}-layout`} className="grid gap-2 sm:grid-cols-2">
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
                      <span className="text-muted-foreground"> · holds {option.capacity}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {verdict ? (
          <SuitabilityChecklist suitability={verdict} label={`Suitability of ${venue?.location}`} />
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">Dates and times</p>
          <p className="text-muted-foreground text-xs">
            One start and end time per date, on the quarter hour, Singapore time. An event that runs
            to midnight ends at 24:00.
          </p>
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border p-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-date-${row.key}`} className="text-xs">
                  Date {index + 1}
                </Label>
                <Input
                  id={`${idPrefix}-date-${row.key}`}
                  name="bookingDate"
                  type="date"
                  value={row.date}
                  onChange={(change) => updateRow(row.key, { date: change.target.value })}
                  className="w-auto"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-start-${row.key}`} className="text-xs">
                  Start
                </Label>
                <TimePicker
                  id={`${idPrefix}-start-${row.key}`}
                  name="bookingStart"
                  label={`Start time on date ${index + 1}`}
                  required={false}
                  value={row.start}
                  onChange={(start) => updateRow(row.key, { start })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-end-${row.key}`} className="text-xs">
                  End
                </Label>
                <TimePicker
                  id={`${idPrefix}-end-${row.key}`}
                  name="bookingEnd"
                  label={`End time on date ${index + 1}`}
                  endOfDay
                  required={false}
                  value={row.end}
                  onChange={(end) => updateRow(row.key, { end })}
                />
              </div>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
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

      {state.status === "submitted" && state.replacingVenueLocation === null ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertTitle>
            Booking request sent for {state.venueLocation}. Venue Staff will review it.
          </AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={!canSubmit || pending}>
        {pending ? "Sending…" : replacesBookingId === undefined ? "Send booking request" : "Send re-request"}
      </Button>
    </form>
  );
}
