import { describe, expect, it } from "vitest";

import {
  ClarificationReplyNotTopLevelError,
  ClarificationThreadNotResolvableError,
} from "./errors";
import {
  clarificationMessageId,
  isLastOpenClarificationRequest,
  openClarificationRequests,
  resolvableClarificationRequest,
  topLevelParentFor,
  type ClarificationMessage,
} from "./clarification-message";
import { eventRequestId } from "./event-request";
import { userAccountId } from "./user-account";

const COORDINATOR = userAccountId("coordinator-1");
const ORGANISER = userAccountId("organiser-1");

function message(
  id: string,
  overrides: Partial<ClarificationMessage> = {},
): ClarificationMessage {
  return {
    id: clarificationMessageId(id),
    eventRequestId: eventRequestId("request-1"),
    authorUserAccountId: COORDINATOR,
    body: "How many need step-free access?",
    postedAt: new Date("2026-09-21T10:00:00.000Z"),
    parentId: null,
    isClarificationRequest: false,
    resolvedAt: null,
    ...overrides,
  };
}

/** A question a return was sent with, still waiting on the Organiser. */
function question(id: string, overrides: Partial<ClarificationMessage> = {}): ClarificationMessage {
  return message(id, { isClarificationRequest: true, ...overrides });
}

describe("openClarificationRequests (SPM-33)", () => {
  it("counts only the questions a return opened, not ordinary comments", () => {
    const thread = [
      question("m1"),
      message("m2", { authorUserAccountId: ORGANISER, parentId: clarificationMessageId("m1") }),
      message("m3"),
      question("m4"),
    ];

    expect(openClarificationRequests(thread).map((m) => m.id)).toEqual(["m1", "m4"]);
  });

  it("stops counting a question once it is resolved", () => {
    const thread = [
      question("m1", { resolvedAt: new Date("2026-09-22T09:00:00.000Z") }),
      question("m2"),
    ];

    expect(openClarificationRequests(thread).map((m) => m.id)).toEqual(["m2"]);
  });

  it("finds nothing open in a thread of plain comments", () => {
    expect(openClarificationRequests([message("m1"), message("m2")])).toEqual([]);
  });
});

describe("resolvableClarificationRequest (SPM-33 AC6)", () => {
  it("finds an open question by id", () => {
    const thread = [message("m1"), question("m2")];

    expect(resolvableClarificationRequest(thread, clarificationMessageId("m2")).id).toBe("m2");
  });

  it("refuses an ordinary comment -- it asked for nothing, so there is nothing to answer", () => {
    expect(() =>
      resolvableClarificationRequest([message("m1")], clarificationMessageId("m1")),
    ).toThrow(ClarificationThreadNotResolvableError);
  });

  it("refuses a question that is already resolved", () => {
    const thread = [question("m1", { resolvedAt: new Date("2026-09-22T09:00:00.000Z") })];

    expect(() => resolvableClarificationRequest(thread, clarificationMessageId("m1"))).toThrow(
      ClarificationThreadNotResolvableError,
    );
  });

  it("refuses an id that is not on this thread at all", () => {
    expect(() =>
      resolvableClarificationRequest([question("m1")], clarificationMessageId("m9")),
    ).toThrow(ClarificationThreadNotResolvableError);
  });
});

describe("isLastOpenClarificationRequest (SPM-33 AC6)", () => {
  it("is true when the question named is the only one still open", () => {
    const thread = [
      question("m1", { resolvedAt: new Date("2026-09-22T09:00:00.000Z") }),
      question("m2"),
      message("m3"),
    ];

    expect(isLastOpenClarificationRequest(thread, clarificationMessageId("m2"))).toBe(true);
  });

  it("is false while another question is still outstanding", () => {
    // The point of resolving per question: answering one of two is not the
    // same as no longer waiting on the Organiser.
    const thread = [question("m1"), question("m2")];

    expect(isLastOpenClarificationRequest(thread, clarificationMessageId("m1"))).toBe(false);
  });

  it("is false for a question that is not itself open", () => {
    const thread = [question("m1", { resolvedAt: new Date("2026-09-22T09:00:00.000Z") })];

    expect(isLastOpenClarificationRequest(thread, clarificationMessageId("m1"))).toBe(false);
  });

  it("ignores ordinary comments entirely -- they never hold the request", () => {
    const thread = [question("m1"), message("m2"), message("m3")];

    expect(isLastOpenClarificationRequest(thread, clarificationMessageId("m1"))).toBe(true);
  });
});

describe("topLevelParentFor (SPM-33 decision 6)", () => {
  it("passes a top-level parent through", () => {
    const thread = [question("m1")];

    expect(topLevelParentFor(thread, clarificationMessageId("m1"))).toBe("m1");
  });

  it("reads no parent as a top-level message of its own", () => {
    expect(topLevelParentFor([question("m1")], null)).toBeNull();
  });

  it("refuses a reply to a reply -- threading is one level", () => {
    const thread = [question("m1"), message("m2", { parentId: clarificationMessageId("m1") })];

    expect(() => topLevelParentFor(thread, clarificationMessageId("m2"))).toThrow(
      ClarificationReplyNotTopLevelError,
    );
  });

  it("refuses a parent that is not on this thread", () => {
    expect(() => topLevelParentFor([question("m1")], clarificationMessageId("m9"))).toThrow(
      ClarificationReplyNotTopLevelError,
    );
  });
});
