import { CalendarDays, ChevronLeft, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildViewEventForRegistration } from "@/composition/container";
import { EventNotFoundError, EventNotOpenForRegistrationError } from "@/core/domain/errors";
import type { AvailableEvent } from "@/core/ports/inbound/available-event";

import { fullDate, timeRange } from "../format-event-time";
import { RegistrationForm } from "./registration-form";

/**
 * An event an attendee may not register for is reported exactly like one that
 * does not exist -- keeping a link should not reveal that an unconfirmed event
 * is being planned (brief s8b).
 *
 * `notFound()` is left to the caller: it throws a control-flow signal Next
 * handles itself, and throwing it from inside a catch block is a good way to
 * have it swallowed.
 */
async function loadEvent(id: string): Promise<AvailableEvent | null> {
  const viewEvent = await buildViewEventForRegistration();

  try {
    const { event } = await viewEvent.execute({ eventId: id });
    return event;
  } catch (error) {
    if (error instanceof EventNotFoundError || error instanceof EventNotOpenForRegistrationError) {
      return null;
    }
    throw error;
  }
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const event = await loadEvent(id);

  if (event === null) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/events"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft aria-hidden className="size-4" />
        All events
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {event.name}
      </h1>

      <dl className="text-muted-foreground mt-4 space-y-2 text-sm">
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
        {event.venueName ? (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Venue</dt>
            <MapPin aria-hidden className="size-4 shrink-0" />
            <dd>{event.venueName}</dd>
          </div>
        ) : null}
      </dl>

      {event.description ? <p className="mt-6 leading-relaxed">{event.description}</p> : null}

      <section className="mt-10 border-t pt-8">
        <h2 className="mb-1 text-lg font-semibold">Register</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          {event.registrationClosesAt
            ? `Registration closes ${fullDate(event.registrationClosesAt)}.`
            : "Secure your place at this event."}
        </p>
        <RegistrationForm event={event} />
      </section>
    </main>
  );
}
