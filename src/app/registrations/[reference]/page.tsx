import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildViewRegistration } from "@/composition/container";
import {
  EventNotFoundError,
  InvalidRegistrationIdError,
  RegistrationNotFoundError,
} from "@/core/domain/errors";
import type { AttendeeRegistration } from "@/core/use-cases/attendee-registration";

import { WithdrawPanel } from "./withdraw-panel";

/**
 * Freshness matters more than caching here: the panel's Withdraw control is
 * rendered from the registration's current status, and a stale page would
 * offer to withdraw something already withdrawn.
 */
export const dynamic = "force-dynamic";

/**
 * A reference that names nothing, that is malformed, or whose event has gone is
 * reported the same way: not found. The reference is the only credential this
 * page has, so distinguishing those cases would tell a guesser which of their
 * guesses was closer.
 *
 * `notFound()` is left to the caller for the reason `events/[id]/page.tsx`
 * gives: throwing it inside a catch block is a good way to have it swallowed.
 */
async function loadRegistration(reference: string): Promise<AttendeeRegistration | null> {
  const viewRegistration = await buildViewRegistration();

  try {
    const { registration } = await viewRegistration.execute({ reference });
    return registration;
  } catch (error) {
    if (
      error instanceof RegistrationNotFoundError ||
      error instanceof InvalidRegistrationIdError ||
      error instanceof EventNotFoundError
    ) {
      return null;
    }
    throw error;
  }
}

export default async function RegistrationPage({
  params,
}: PageProps<"/registrations/[reference]">) {
  const { reference } = await params;
  const registration = await loadRegistration(reference);

  if (registration === null) {
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

      <h1 className="text-2xl font-semibold tracking-tight text-balance">Your registration</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Registered as {registration.attendeeName} ({registration.attendeeEmail}).
      </p>

      <div className="mt-8">
        <WithdrawPanel registration={registration} />
      </div>
    </main>
  );
}
