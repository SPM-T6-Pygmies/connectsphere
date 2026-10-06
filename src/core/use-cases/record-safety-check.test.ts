import { describe, expect, it } from "vitest";

import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import {
  COORDINATOR,
  SAFETY_OFFICER,
  safetyCheckReview,
  safetyCheckStore,
} from "@/adapters/outbound/in-memory/safety-check-fixture";
import {
  EventNotAwaitingSafetyCheckError,
  EventNotFoundError,
  NotSafetyOfficerError,
  SafetyCheckCommentsRequiredError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";

import { RecordSafetyCheckUseCase } from "./record-safety-check";

const EVENT = eventId("event-1");

function build(seed = [safetyCheckReview()]) {
  const safetyChecks = safetyCheckStore(seed);
  const notifier = new RecordingNotifier();
  return { safetyChecks, notifier, record: new RecordSafetyCheckUseCase({ safetyChecks, notifier }) };
}

async function stored(safetyChecks: ReturnType<typeof safetyCheckStore>) {
  return safetyChecks.review(userAccountId(SAFETY_OFFICER), EVENT);
}

describe("RecordSafetyCheckUseCase (SPM-260)", () => {
  it("AC2, AC4, AC5, AC6: records an approval with no comments, by whom and when, and the event is checked", async () => {
    const { safetyChecks, record } = build();

    await record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" });

    const review = await stored(safetyChecks);
    expect(review?.candidate.checked).toBe(true);
    expect(review?.checks).toEqual([
      {
        outcome: "Approved",
        comments: null,
        checkedByName: "Test Safety Officer",
        checkedAt: "2026-10-06T09:30:00.000Z",
      },
    ]);
  });

  it("AC3: records a rejection with its comments, trimmed", async () => {
    const { safetyChecks, record } = build();

    await record.execute({
      userAccountId: SAFETY_OFFICER,
      eventId: "event-1",
      outcome: "Rejected",
      comments: "  Grand Ballroom banquet layout holds 180; 220 expected.  ",
    });

    expect((await stored(safetyChecks))?.checks[0]).toMatchObject({
      outcome: "Rejected",
      comments: "Grand Ballroom banquet layout holds 180; 220 expected.",
    });
  });

  it("AC3: refuses a rejection with blank comments and records nothing", async () => {
    const { safetyChecks, record } = build();

    await expect(
      record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Rejected", comments: "   " }),
    ).rejects.toBeInstanceOf(SafetyCheckCommentsRequiredError);

    const review = await stored(safetyChecks);
    expect(review?.checks).toEqual([]);
    expect(review?.candidate.checked).toBe(false);
  });

  it("AC5: adds the new outcome above an earlier one and leaves the earlier one as it was", async () => {
    // As SPM-261 will leave an event sent back for a fresh check: an earlier outcome, awaiting again.
    const earlier = {
      outcome: "Rejected" as const,
      comments: "Add a second fire marshal.",
      checkedByName: "Test Safety Officer 2",
      checkedAt: "2026-10-01T10:00:00.000Z",
    };
    const { safetyChecks, record } = build([safetyCheckReview({ checks: [earlier] })]);

    await record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" });

    const checks = (await stored(safetyChecks))?.checks;
    expect(checks?.map((check) => check.outcome)).toEqual(["Approved", "Rejected"]);
    expect(checks?.[1]).toEqual(earlier);
  });

  it("AC6: refuses an event that has already been checked", async () => {
    const { record } = build([
      safetyCheckReview({ candidate: { ...safetyCheckReview().candidate, checked: true } }),
    ]);

    await expect(
      record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" }),
    ).rejects.toBeInstanceOf(EventNotAwaitingSafetyCheckError);
  });

  it("AC6: when two Officers record at once, the store refuses the second", async () => {
    const { safetyChecks, record } = build();

    const [first, second] = await Promise.allSettled([
      record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" }),
      record.execute({ userAccountId: "safety-2", eventId: "event-1", outcome: "Rejected", comments: "Too crowded." }),
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second).toMatchObject({ status: "rejected", reason: expect.any(EventNotAwaitingSafetyCheckError) });
    expect((await stored(safetyChecks))?.checks).toHaveLength(1);
  });

  it("AC7: refuses anyone who is not a Safety Officer", async () => {
    const { record } = build();

    await expect(
      record.execute({ userAccountId: "venue-1", eventId: "event-1", outcome: "Approved", comments: "" }),
    ).rejects.toBeInstanceOf(NotSafetyOfficerError);
  });

  it("AC7: an unknown event is not found", async () => {
    const { record } = build();

    await expect(
      record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-9", outcome: "Approved", comments: "" }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });
});

describe("RecordSafetyCheckUseCase telling the coordinator (SPM-263)", () => {
  it("AC1, AC2: tells only the event's coordinator of a rejection, with the comments as stored", async () => {
    const { notifier, record } = build();

    await record.execute({
      userAccountId: SAFETY_OFFICER,
      eventId: "event-1",
      outcome: "Rejected",
      comments: "  Banquet layout holds 180; 220 expected.  ",
    });

    expect(notifier.safetyChecksRecorded).toEqual([
      {
        recipientUserAccountId: COORDINATOR,
        eventId: "event-1",
        eventName: "Founders' Gala Dinner",
        outcome: "Rejected",
        comments: "Banquet layout holds 180; 220 expected.",
      },
    ]);
  });

  it("AC1, AC3: tells the coordinator of an approval with no comments", async () => {
    const { notifier, record } = build();

    await record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" });

    expect(notifier.safetyChecksRecorded).toEqual([
      expect.objectContaining({ recipientUserAccountId: COORDINATOR, outcome: "Approved", comments: null }),
    ]);
  });

  it("AC6: stores the outcome before telling anyone", async () => {
    const { safetyChecks, notifier, record } = build();
    let storedWhenNotified: number | undefined;
    notifier.safetyCheckRecorded = async () => {
      storedWhenNotified = (await stored(safetyChecks))?.checks.length;
    };

    await record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" });

    expect(storedWhenNotified).toBe(1);
  });

  it("AC6: records the outcome and tells nobody when the event has no coordinator", async () => {
    const { safetyChecks, notifier, record } = build([safetyCheckReview({ coordinatorUserAccountId: null })]);

    await record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" });

    expect((await stored(safetyChecks))?.checks).toHaveLength(1);
    expect(notifier.safetyChecksRecorded).toEqual([]);
  });

  it("AC6: tells nobody when the outcome is refused", async () => {
    const { notifier, record } = build();

    await expect(
      record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Rejected", comments: " " }),
    ).rejects.toBeInstanceOf(SafetyCheckCommentsRequiredError);

    expect(notifier.safetyChecksRecorded).toEqual([]);
  });

  it("AC6: tells the coordinator only of the outcome that was stored when two Officers record at once", async () => {
    const { notifier, record } = build();

    await Promise.allSettled([
      record.execute({ userAccountId: SAFETY_OFFICER, eventId: "event-1", outcome: "Approved", comments: "" }),
      record.execute({ userAccountId: "safety-2", eventId: "event-1", outcome: "Rejected", comments: "Too crowded." }),
    ]);

    expect(notifier.safetyChecksRecorded.map((notice) => notice.outcome)).toEqual(["Approved"]);
  });
});
