import { describe, expect, it } from "vitest";

import { InMemoryExpiredHoldNotices } from "@/adapters/outbound/in-memory/in-memory-expired-hold-notices";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";

import type { BookingId } from "../domain/booking";
import type { ExpiredHold } from "../ports/outbound/expired-hold-notices";
import { NotifyExpiredHoldsUseCase } from "./notify-expired-holds";

function hold(overrides: Partial<ExpiredHold> = {}): ExpiredHold {
  return {
    bookingId: "31" as BookingId,
    eventId: "8",
    eventRequestId: "6",
    eventName: "Harbour Lights Gala",
    coordinatorUserAccountId: "3",
    venueLocation: "Grand Ballroom",
    slots: [{ date: "2026-11-20", slot: "PM" }],
    holdExpiresAt: "2026-11-18T05:00:00.000Z",
    ...overrides,
  };
}

function setup(seed: readonly ExpiredHold[]) {
  const notifier = new RecordingNotifier();
  const useCase = new NotifyExpiredHoldsUseCase({ holds: new InMemoryExpiredHoldNotices(seed), notifier });
  return { notifier, useCase };
}

describe("NotifyExpiredHoldsUseCase (SPM-254)", () => {
  it("AC1, AC2: tells the coordinator the hold expired, naming the venue, the held slots and the expiry", async () => {
    const { notifier, useCase } = setup([hold()]);

    await useCase.execute();

    expect(notifier.holdsExpired).toEqual([
      {
        recipientUserAccountId: "3",
        bookingId: "31",
        eventId: "8",
        eventRequestId: "6",
        eventName: "Harbour Lights Gala",
        venueLocation: "Grand Ballroom",
        slots: [{ date: "2026-11-20", slot: "PM" }],
        holdExpiresAt: "2026-11-18T05:00:00.000Z",
      },
    ]);
  });

  it("AC1: tells each event's own coordinator when several holds expired", async () => {
    const { notifier, useCase } = setup([
      hold(),
      hold({ bookingId: "32" as BookingId, eventId: "9", coordinatorUserAccountId: "4" }),
    ]);

    await useCase.execute();

    expect(notifier.holdsExpired.map((n) => [n.bookingId, n.recipientUserAccountId])).toEqual([
      ["31", "3"],
      ["32", "4"],
    ]);
  });

  it("AC3: tells the coordinator once per hold, however many sweeps run", async () => {
    const { notifier, useCase } = setup([hold()]);

    await useCase.execute();
    await useCase.execute();

    expect(notifier.holdsExpired).toHaveLength(1);
  });

  it("tells nobody when the event has no coordinator", async () => {
    const { notifier, useCase } = setup([hold({ coordinatorUserAccountId: null })]);

    await useCase.execute();

    expect(notifier.holdsExpired).toEqual([]);
  });

  it("tells nobody when no hold has expired", async () => {
    const { notifier, useCase } = setup([]);

    await useCase.execute();

    expect(notifier.holdsExpired).toEqual([]);
  });
});
