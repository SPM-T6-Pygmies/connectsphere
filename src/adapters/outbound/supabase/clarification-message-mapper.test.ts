import { describe, expect, it } from "vitest";

import { clarificationMessageId } from "@/core/domain/clarification-message";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import {
  toDomain,
  toPostArgs,
  type ClarificationMessageRow,
} from "./clarification-message-mapper";

function row(overrides: Partial<ClarificationMessageRow> = {}): ClarificationMessageRow {
  return {
    comment_id: 12,
    event_request_id: 42,
    author_user_account_id: 7,
    parent_comment_id: null,
    body: "How many need step-free access?",
    created_at: "2026-09-21T10:15:00.000Z",
    ...overrides,
  };
}

describe("clarification message mapper (SPM-33)", () => {
  it("maps a stored top-level message into the domain", () => {
    expect(toDomain(row())).toEqual({
      id: "12",
      eventRequestId: "42",
      authorUserAccountId: "7",
      body: "How many need step-free access?",
      postedAt: new Date("2026-09-21T10:15:00.000Z"),
      parentId: null,
    });
  });

  it("carries a reply's parent across as an id, not a number", () => {
    expect(toDomain(row({ comment_id: 13, parent_comment_id: 12 })).parentId).toBe("12");
  });

  it("builds the arguments for a top-level message, with a null parent", () => {
    expect(
      toPostArgs({
        eventRequestId: eventRequestId("42"),
        authorUserAccountId: userAccountId("7"),
        body: "Captions only.",
        parentId: null,
      }),
    ).toEqual({
      p_event_request_id: 42,
      p_author_user_account_id: 7,
      p_body: "Captions only.",
      p_parent_comment_id: null,
    });
  });

  it("builds the arguments for a reply", () => {
    expect(
      toPostArgs({
        eventRequestId: eventRequestId("42"),
        authorUserAccountId: userAccountId("7"),
        body: "Captions only.",
        parentId: clarificationMessageId("12"),
      })?.p_parent_comment_id,
    ).toBe(12);
  });

  it.each([
    ["the request id", { eventRequestId: eventRequestId("not-a-key") }],
    ["the author id", { authorUserAccountId: userAccountId("not-a-key") }],
    ["the parent id", { parentId: clarificationMessageId("not-a-key") }],
  ])("refuses to build arguments when %s is not a key this store could hold", (_label, override) => {
    expect(
      toPostArgs({
        eventRequestId: eventRequestId("42"),
        authorUserAccountId: userAccountId("7"),
        body: "Captions only.",
        parentId: null,
        ...override,
      }),
    ).toBeNull();
  });
});
