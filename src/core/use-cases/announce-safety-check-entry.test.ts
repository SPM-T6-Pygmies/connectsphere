import { describe, expect, it } from "vitest";

import { InMemorySafetyCheckWatch } from "@/adapters/outbound/in-memory/in-memory-safety-check-watch";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import type { BookingId } from "@/core/domain/booking";
import { eventId } from "@/core/domain/event";
import type { SafetyCheckCandidate } from "@/core/domain/safety-check";

import { SafetyCheckEntryAnnouncer } from "./announce-safety-check-entry";

const EVENT = eventId("event-1");
const BOOKING = "booking-2" as BookingId;

function gala(pending: boolean): SafetyCheckCandidate {
  return {
    event: { id: EVENT, name: "Harbour Lights Gala", status: "Planning", preferredDate: "2026-11-20", expectedAttendance: 150 },
    bookings: [
      { status: "Confirmed", venueName: "Grand Ballroom" },
      { status: pending ? "Requested" : "Confirmed", venueName: "Sky Terrace" },
    ],
    equipmentLines: [],
    checked: false,
  };
}

function announcer(before: SafetyCheckCandidate) {
  const watch = new InMemorySafetyCheckWatch([before], ["safety-1", "safety-2"], { [BOOKING]: EVENT });
  const notifier = new RecordingNotifier();
  return { watch, notifier, announcer: new SafetyCheckEntryAnnouncer({ watch, notifier }) };
}

describe("SafetyCheckEntryAnnouncer (SPM-262)", () => {
  it("AC1, AC4, AC5: tells every Safety Officer, with its venues, equipment and date, when a change puts the event on the list", async () => {
    const { watch, notifier, announcer: a } = announcer(gala(true));

    const result = await a.around({ bookingId: BOOKING }, async () => {
      watch.set(gala(false));
      return "decided";
    });

    expect(result).toBe("decided");
    expect(notifier.safetyChecksReady).toEqual([
      {
        recipientUserAccountId: "safety-1",
        eventId: "event-1",
        eventName: "Harbour Lights Gala",
        preferredDate: "2026-11-20",
        venues: ["Grand Ballroom", "Sky Terrace"],
        equipmentLines: 0,
      },
      {
        recipientUserAccountId: "safety-2",
        eventId: "event-1",
        eventName: "Harbour Lights Gala",
        preferredDate: "2026-11-20",
        venues: ["Grand Ballroom", "Sky Terrace"],
        equipmentLines: 0,
      },
    ]);
  });

  it("AC2: watches an event named by its id as well as by one of its bookings", async () => {
    const { watch, notifier, announcer: a } = announcer(gala(true));

    await a.around({ eventId: EVENT }, async () => watch.set(gala(false)));

    expect(notifier.safetyChecksReady).toHaveLength(2);
  });

  it("AC3: tells no one when the change leaves the event off the list", async () => {
    const { notifier, announcer: a } = announcer(gala(true));

    await a.around({ eventId: EVENT }, async () => undefined);

    expect(notifier.safetyChecksReady).toEqual([]);
  });

  it("AC3: tells no one again when the event was already on the list", async () => {
    const { watch, notifier, announcer: a } = announcer(gala(false));

    await a.around({ eventId: EVENT }, async () => watch.set(gala(false)));

    expect(notifier.safetyChecksReady).toEqual([]);
  });

  it("AC3: tells no one when the change fails", async () => {
    const { watch, notifier, announcer: a } = announcer(gala(true));

    await expect(
      a.around({ eventId: EVENT }, async () => {
        watch.set(gala(false));
        throw new Error("refused");
      }),
    ).rejects.toThrow("refused");
    expect(notifier.safetyChecksReady).toEqual([]);
  });
});
