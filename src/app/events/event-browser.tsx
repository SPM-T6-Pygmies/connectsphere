"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { AvailableEvent } from "@/core/ports/inbound/available-event";

import { EventCard } from "./event-card";
import { dayHeading, dayKey, weekdayOf } from "./format-event-time";

/**
 * The list, with a name search over it.
 *
 * The search is a presentation affordance, not a business rule: it narrows
 * what is already on screen and asks the server nothing. Which events exist to
 * be searched is decided by ListEventsOpenForRegistrationUseCase.
 */
export function EventBrowser({
  events,
  nowIso,
}: {
  events: readonly AvailableEvent[];
  nowIso: string;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? events.filter((event) => event.name.toLowerCase().includes(needle))
      : events;

    const byDay = new Map<string, AvailableEvent[]>();
    for (const event of matching) {
      const key = dayKey(event.startsAt);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
    return [...byDay.values()];
  }, [events, query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events"
          aria-label="Search events by name"
          className="pl-9"
        />
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          {query.trim()
            ? `No events match “${query.trim()}”.`
            : "There are no events open for registration right now."}
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={dayKey(group[0].startsAt)} className="space-y-3">
              <h2 className="text-lg font-semibold">
                {dayHeading(group[0].startsAt, nowIso)}{" "}
                <span className="text-muted-foreground font-normal">
                  / {weekdayOf(group[0].startsAt)}
                </span>
              </h2>
              <div className="space-y-3">
                {group.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
