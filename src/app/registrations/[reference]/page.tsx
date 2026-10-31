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
 * A reference that names nothing or is malformed is reported as not found. A
 * reference that names a registration whose event the attendee cannot read --
 * back in Planning after a reschedule, or cancelled -- is not: the registration
 * exists, and the reference is the credential, so saying "not found" would be
 * untrue. The page says the details are not available instead (SPM-69).
 *
 * `notFound()` is left to the caller for the reason `events/[id]/page.tsx`
 * gives: throwing it inside a catch block is a good way to have it swallowed.
 */
async function loadRegistration(
  reference: string,
): Promise<AttendeeRegistration | "event-unavailable" | null> {
  const viewRegistration = await buildViewRegistration();

  try {
    const { registration } = await viewRegistration.execute({ reference });
    return registration;
  } catch (error) {
    if (error instanceof EventNotFoundError) {
      return "event-unavailable";
    }
    if (error instanceof RegistrationNotFoundError || error instanceof InvalidRegistrationIdError) {
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

  if (registration === "event-unavailable") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          This event&rsquo;s details aren&rsquo;t available right now
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your registration is kept. Any change to the event is emailed to you, so check your inbox for the latest.
        </p>
        <Link
          href="/events"
          className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft aria-hidden className="size-4" />
          All events
        </Link>
      </main>
    );
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
