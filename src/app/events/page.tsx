import { Suspense } from "react";

import { buildListEventsOpenForRegistration } from "@/composition/container";

import { EventBrowser } from "./event-browser";
import { EventListSkeleton } from "./event-list-skeleton";

/**
 * Which events are open depends on the time this page is asked for, so it must
 * not be prerendered at build time. Reading from Supabase would force this
 * anyway; declaring it keeps the page correct under the seeded adapters too.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Events open for registration | ConnectSphere",
  description: "Browse ConnectSphere events you can register for.",
};

/**
 * The public event list.
 *
 * A read, so it calls the use case directly rather than going out to an HTTP
 * endpoint and back. Everything the page is allowed to show has already been
 * decided by the time the data arrives.
 */
async function EventList() {
  const listEvents = await buildListEventsOpenForRegistration();
  const { events } = await listEvents.execute();

  return <EventBrowser events={events} nowIso={new Date().toISOString()} />;
}

export default function EventsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Events</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything open for registration right now. Times are Singapore time.
        </p>
      </header>

      {/*
        The skeleton lives here rather than in a segment-level loading.tsx: that
        file would wrap /events/[id] in a Suspense boundary too, flushing the
        shell before notFound() can set a 404 on an event that is not open.
      */}
      <Suspense fallback={<EventListSkeleton />}>
        <EventList />
      </Suspense>
    </main>
  );
}
