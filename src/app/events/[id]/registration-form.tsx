"use client";

import { CalendarDays, CheckCircle2, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AvailableEvent } from "@/core/ports/inbound/available-event";

import { fullDate, timeRange } from "../format-event-time";
import { registerForEventAction, type RegistrationState } from "./actions";

const INITIAL: RegistrationState = { status: "idle" };

export function RegistrationForm({ event }: { event: AvailableEvent }) {
  const [state, formAction, pending] = useActionState(registerForEventAction, INITIAL);

  if (state.status === "registered") {
    return <Confirmation event={state.event} />;
  }

  // React resets an uncontrolled form once its action settles, so a refused
  // attempt would otherwise wipe what the attendee typed.
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={event.id} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={values?.fullName}
          required
        />
        {state.status === "error" && state.fieldErrors?.fullName ? (
          <p className="text-destructive text-sm">{state.fieldErrors.fullName[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={values?.email}
          required
        />
        {state.status === "error" && state.fieldErrors?.email ? (
          <p className="text-destructive text-sm">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      {state.status === "error" && !state.fieldErrors ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Registering…" : "Register"}
      </Button>
    </form>
  );
}

/**
 * SPM-82: name, date, time and venue, read back from what the server recorded
 * rather than echoed from the form.
 */
function Confirmation({ event }: { event: AvailableEvent }) {
  return (
    <div className="space-y-4" role="status">
      <div className="flex items-center gap-2">
        <CheckCircle2 aria-hidden className="size-5 shrink-0" />
        <h2 className="text-lg font-semibold">You&rsquo;re registered</h2>
      </div>

      <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
        <p className="font-semibold text-balance">{event.name}</p>
        <dl className="text-muted-foreground space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Date</dt>
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            <dd>{fullDate(event.startsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Time</dt>
            <Clock aria-hidden className="size-4 shrink-0" />
            <dd>{timeRange(event.startsAt, event.endsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Venue</dt>
            <MapPin aria-hidden className="size-4 shrink-0" />
            <dd>{event.venueName ?? "Venue to be confirmed"}</dd>
          </div>
        </dl>
      </div>

      <Button asChild variant="outline">
        <Link href="/events">Back to events</Link>
      </Button>
    </div>
  );
}
