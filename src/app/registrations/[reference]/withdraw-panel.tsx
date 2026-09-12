"use client";

import { CalendarDays, CheckCircle2, Clock, MapPin } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { AttendeeRegistration } from "@/core/use-cases/attendee-registration";

import { fullDate, timeRange } from "../../events/format-event-time";
import { withdrawRegistrationAction, type WithdrawalState } from "./actions";

const INITIAL: WithdrawalState = { status: "idle" };

/**
 * The registration, and the Withdraw control when there is one to offer.
 *
 * `canWithdraw` is asked, never worked out: whether withdrawal is still allowed
 * is a business decision the core already made (SPM-84). This component's only
 * job is to render its answer, so there is nothing here to get wrong -- which
 * matters, because vitest collects `*.test.ts` only and no component test can
 * cover it.
 */
export function WithdrawPanel({ registration }: { registration: AttendeeRegistration }) {
  const [state, formAction, pending] = useActionState(withdrawRegistrationAction, INITIAL);

  // The server-rendered registration until the action returns a newer one.
  const current = state.status === "withdrawn" ? state.registration : registration;
  const justWithdrew = state.status === "withdrawn";

  return (
    <div className="space-y-4">
      {justWithdrew ? (
        <div className="flex items-center gap-2" role="status">
          <CheckCircle2 aria-hidden className="size-5 shrink-0" />
          <h2 className="text-lg font-semibold">Your registration is withdrawn</h2>
        </div>
      ) : null}

      <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
        <p className="font-semibold text-balance">{current.event.name}</p>
        <dl className="text-muted-foreground space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Date</dt>
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            <dd>{fullDate(current.event.startsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Time</dt>
            <Clock aria-hidden className="size-4 shrink-0" />
            <dd>{timeRange(current.event.startsAt, current.event.endsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Venue</dt>
            <MapPin aria-hidden className="size-4 shrink-0" />
            <dd>{current.event.venueName ?? "Venue to be confirmed"}</dd>
          </div>
        </dl>
      </div>

      {state.status === "error" ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {state.message}
        </p>
      ) : null}

      {current.canWithdraw ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="reference" value={current.reference} />
          <p className="text-muted-foreground text-sm">
            Withdrawing releases your place so someone else can take it. It cannot be undone, but
            you can register again while registration is open.
          </p>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Withdrawing…" : "Withdraw my registration"}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground text-sm">
          {current.status === "withdrawn"
            ? "You withdrew this registration, so your place has been released."
            : "This event has already taken place, so this registration can no longer be withdrawn."}
        </p>
      )}
    </div>
  );
}
