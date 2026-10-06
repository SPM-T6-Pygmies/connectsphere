"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BOOKING_SLOTS } from "@/core/domain/booking";
import { UNAVAILABILITY_NOTE_MAX_LENGTH, UNAVAILABILITY_REASONS } from "@/core/domain/venue-unavailability";

import { OptionCheckboxes, OptionSelect } from "../../option-fields";
import { slotLabel } from "../../slot-label";
import { recordUnavailabilityAction, type RecordUnavailabilityState } from "./actions";

const INITIAL: RecordUnavailabilityState = { status: "idle" };

function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * The "Mark unavailable" form (SPM-21). The same ticked slots apply to every
 * day from the start date to the end date. The submit button waits for the
 * fields that are always needed; whether the dates make sense, and whether a
 * note belongs under the reason, are the domain's call and come back as a
 * message. After a save, the bookings the block sits over are listed, read-only.
 */
export function UnavailabilityForm({
  venues,
  defaultVenueId,
}: {
  venues: ReadonlyArray<{ id: string; location: string }>;
  defaultVenueId?: string;
}) {
  const [state, formAction, pending] = useActionState(recordUnavailabilityAction, INITIAL);

  const [venueId, setVenueId] = useState(
    venues.some((venue) => venue.id === defaultVenueId) ? (defaultVenueId ?? "") : "",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slots, setSlots] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (state.status === "saved") {
      toast.success("Venue marked unavailable.");
    }
  }, [state]);

  const readyToSubmit = [venueId, startDate, endDate, slots, reason].every(isFilled);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
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
              Coordinators cannot request the ticked slots while the block is in force. Existing
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
                onChange={(event) => setVenueId(event.target.value)}
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

            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                Slots, on every day in the range <span className="text-destructive">*</span>
              </Label>
              <OptionCheckboxes
                name="slots"
                options={BOOKING_SLOTS}
                value={slots}
                onChange={setSlots}
                label={slotLabel}
              />
            </div>

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

      {state.status === "saved" ? <AffectedBookings state={state} /> : null}
    </div>
  );
}

/** AC11: what the block sits over, read-only, or that nothing is affected. */
function AffectedBookings({ state }: { state: Extract<RecordUnavailabilityState, { status: "saved" }> }) {
  const { affectedBookings, entry } = state;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings this block overlaps</CardTitle>
        <CardDescription>
          {entry.venueLocation} is now blocked. These bookings and their events are unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {affectedBookings.length === 0 ? (
          <p className="text-sm">No bookings are affected.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {affectedBookings.map((booking) => (
              <li key={`${booking.bookingId}-${booking.date}-${booking.slot}`}>
                <span className="font-medium">{booking.eventName}</span> · {booking.date} {booking.slot} ·{" "}
                {booking.status}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
