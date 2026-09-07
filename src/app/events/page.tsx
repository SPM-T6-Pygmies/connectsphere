import { buildListEventsOpenForRegistration } from "@/composition/container";

import { EventBrowser } from "./event-browser";

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
export default async function EventsPage() {
  const listEvents = await buildListEventsOpenForRegistration();
  const { events } = await listEvents.execute();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Events</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything open for registration right now. Times are Singapore time.
        </p>
      </header>

      <EventBrowser events={events} nowIso={new Date().toISOString()} />
    </main>
  );
}
