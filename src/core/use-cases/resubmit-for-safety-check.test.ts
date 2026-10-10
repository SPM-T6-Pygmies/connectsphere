import { describe, expect, it } from "vitest";

import { InMemorySafetyCheckWatch } from "@/adapters/outbound/in-memory/in-memory-safety-check-watch";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import {
  COORDINATOR,
  SAFETY_OFFICER,
  safetyCheckReview,
  safetyCheckStore,
} from "@/adapters/outbound/in-memory/safety-check-fixture";
import { EventNotFoundError, SafetyCheckNotResubmittableError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { awaitsSafetyCheck } from "@/core/domain/safety-check";
import { userAccountId } from "@/core/domain/user-account";
import type { SafetyCheckEntry, SafetyCheckReview } from "@/core/ports/outbound/safety-check-repository";

import { SafetyCheckEntryAnnouncer } from "./announce-safety-check-entry";
import { RecordSafetyCheckUseCase } from "./record-safety-check";
import { ResubmitForSafetyCheckUseCase } from "./resubmit-for-safety-check";
import { ViewEventSafetyChecksUseCase } from "./view-event-safety-checks";

const EVENT = eventId("event-1");

const rejection: SafetyCheckEntry = {
  outcome: "Rejected",
  comments: "Banquet layout holds 180; 220 expected.",
  checkedByName: "Test Safety Officer",
  checkedAt: "2026-10-05T08:00:00.000Z",
  resubmittedAt: null,
};

/** An event the Safety Officer has just rejected. */
function rejected(overrides: Partial<SafetyCheckReview> = {}): SafetyCheckReview {
  const base = safetyCheckReview();
  return safetyCheckReview({ candidate: { ...base.candidate, checked: true }, checks: [rejection], ...overrides });
}

function build(seed = [rejected()]) {
  const safetyChecks = safetyCheckStore(seed);
  const notifier = new RecordingNotifier();
  // The watch reads the event as the store holds it, so the announcer sees the change.
  const watch = new InMemorySafetyCheckWatch([], ["safety-1", "safety-2"]);
  watch.candidateForEvent = async (id) =>
    (await safetyChecks.review(userAccountId(SAFETY_OFFICER), id))?.candidate ?? null;
  const announcer = new SafetyCheckEntryAnnouncer({ watch, notifier });
  return {
    safetyChecks,
    notifier,
    resubmit: new ResubmitForSafetyCheckUseCase({ safetyChecks, safetyCheck: announcer }),
    view: new ViewEventSafetyChecksUseCase({ safetyChecks }),
    record: new RecordSafetyCheckUseCase({ safetyChecks, notifier }),
  };
}

const asCoordinator = { userAccountId: COORDINATOR, eventId: "event-1" };

describe("ViewEventSafetyChecksUseCase (SPM-261)", () => {
  it("AC2: shows the event's coordinator what the Safety Officer said, and offers to resubmit", async () => {
    await expect(build().view.execute(asCoordinator)).resolves.toEqual({ checks: [rejection], canResubmit: true });
  });

  it("AC2: an event with no check yet has none to show and nothing to resubmit", async () => {
    await expect(build([safetyCheckReview()]).view.execute(asCoordinator)).resolves.toEqual({
      checks: [],
      canResubmit: false,
    });
  });

  it("AC3: does not offer to resubmit after an approval", async () => {
    const approved = rejected({ checks: [{ ...rejection, outcome: "Approved", comments: null }] });

    await expect(build([approved]).view.execute(asCoordinator)).resolves.toMatchObject({ canResubmit: false });
  });

  it("AC5: shows another coordinator nothing", async () => {
    await expect(build().view.execute({ userAccountId: "coordinator-2", eventId: "event-1" })).resolves.toBeNull();
  });
});

describe("ResubmitForSafetyCheckUseCase (SPM-261)", () => {
  it("AC1: a rejected event stays Planning and off the list until it is resubmitted", async () => {
    const review = await build().safetyChecks.review(userAccountId(SAFETY_OFFICER), EVENT);

    expect(review?.candidate.event.status).toBe("Planning");
    expect(awaitsSafetyCheck(review!.candidate)).toBe(false);
  });

  it("AC3, AC4: resubmitting stamps the rejection and puts the event back on the list", async () => {
    const { safetyChecks, resubmit, view } = build();

    await resubmit.execute(asCoordinator);

    const review = await safetyChecks.review(userAccountId(SAFETY_OFFICER), EVENT);
    expect(awaitsSafetyCheck(review!.candidate)).toBe(true);
    expect(review?.checks).toEqual([{ ...rejection, resubmittedAt: "2026-10-06T09:30:00.000Z" }]);
    await expect(view.execute(asCoordinator)).resolves.toMatchObject({ canResubmit: false });
  });

  it("AC4: tells every Safety Officer the event is back on their list", async () => {
    const { notifier, resubmit } = build();

    await resubmit.execute(asCoordinator);

    expect(notifier.safetyChecksReady.map((notice) => [notice.recipientUserAccountId, notice.eventId])).toEqual([
      ["safety-1", "event-1"],
      ["safety-2", "event-1"],
    ]);
  });

  it("AC4: a resubmitted event takes a new outcome, and the earlier one stays in its history", async () => {
    const { safetyChecks, resubmit, record } = build();

    await resubmit.execute(asCoordinator);
    await record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" });

    const checks = (await safetyChecks.review(userAccountId(SAFETY_OFFICER), EVENT))?.checks;
    expect(checks?.map((check) => check.outcome)).toEqual(["Approved", "Rejected"]);
    expect(checks?.[1]).toEqual({ ...rejection, resubmittedAt: "2026-10-06T09:30:00.000Z" });
  });

  it("AC4: an event whose rework left a booking unconfirmed is resubmitted but not yet on the list", async () => {
    const base = rejected();
    const reworked = rejected({
      candidate: { ...base.candidate, bookings: [{ status: "Requested", venueName: "Grand Ballroom" }] },
    });
    const { safetyChecks, notifier, resubmit } = build([reworked]);

    await resubmit.execute(asCoordinator);

    const review = await safetyChecks.review(userAccountId(SAFETY_OFFICER), EVENT);
    expect(review?.checks[0]?.resubmittedAt).not.toBeNull();
    expect(awaitsSafetyCheck(review!.candidate)).toBe(false);
    expect(notifier.safetyChecksReady).toEqual([]);
  });

  it("AC3: refuses an event whose latest check is an approval, and changes nothing", async () => {
    const approved = rejected({ checks: [{ ...rejection, outcome: "Approved", comments: null }] });
    const { safetyChecks, notifier, resubmit } = build([approved]);

    await expect(resubmit.execute(asCoordinator)).rejects.toBeInstanceOf(SafetyCheckNotResubmittableError);

    expect((await safetyChecks.review(userAccountId(SAFETY_OFFICER), EVENT))?.checks[0]?.resubmittedAt).toBeNull();
    expect(notifier.safetyChecksReady).toEqual([]);
  });

  it("AC3: refuses an event already resubmitted", async () => {
    const { resubmit } = build();
    await resubmit.execute(asCoordinator);

    await expect(resubmit.execute(asCoordinator)).rejects.toBeInstanceOf(SafetyCheckNotResubmittableError);
  });

  it("AC3: refuses an event with no check yet", async () => {
    await expect(build([safetyCheckReview()]).resubmit.execute(asCoordinator)).rejects.toBeInstanceOf(
      SafetyCheckNotResubmittableError,
    );
  });

  it("AC3: when the coordinator presses twice at once, the store refuses the second", async () => {
    const { safetyChecks, resubmit } = build();

    const [first, second] = await Promise.allSettled([
      resubmit.execute(asCoordinator),
      resubmit.execute(asCoordinator),
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second).toMatchObject({ status: "rejected", reason: expect.any(SafetyCheckNotResubmittableError) });
    expect((await safetyChecks.review(userAccountId(SAFETY_OFFICER), EVENT))?.checks).toHaveLength(1);
  });

  it("AC5: refuses another coordinator as if the event did not exist", async () => {
    await expect(
      build().resubmit.execute({ userAccountId: "coordinator-2", eventId: "event-1" }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });
});
