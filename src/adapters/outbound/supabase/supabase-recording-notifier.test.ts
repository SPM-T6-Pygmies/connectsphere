import { inspect } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Notifier } from "@/core/ports/outbound/notifier";

import type { SupabaseAdminClient } from "./client";
import { SupabaseRecordingNotifier } from "./supabase-recording-notifier";

const SECRET = "the-novu-secret-key";

/** Shaped like a Novu SDK failure: the request it made, headers and all, hangs off `cause`. */
function novuFailure() {
  return new Error("Novu rejected attendee-email: workflow_not_found", {
    cause: { rawValue: { request$: { headers: { authorization: SECRET } } } },
  });
}

function supabaseThatRecords() {
  const chain = {
    insert: () => chain,
    select: () => chain,
    single: () => Promise.resolve({ data: { notification_id: 1 }, error: null }),
    update: () => chain,
    eq: () => Promise.resolve({ error: null }),
  };
  return { from: () => chain } as unknown as SupabaseAdminClient;
}

describe("SupabaseRecordingNotifier delivery failures (SPM-177)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs why an unrecorded delivery failed, without the request's credentials", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const inner = { eventCancelledForAttendee: vi.fn().mockRejectedValue(novuFailure()) } as unknown as Notifier;

    await new SupabaseRecordingNotifier(supabaseThatRecords(), inner).eventCancelledForAttendee({
      registrationId: "r1",
      recipientEmail: "ada@example.com",
      attendeeName: "Ada Lovelace",
      eventName: "Pygmies Product Summit",
    });

    const logged = inspect(log.mock.calls, { depth: null });
    expect(logged).toContain("workflow_not_found");
    expect(logged).not.toContain(SECRET);
  });

  it("logs why a recorded delivery failed, without the request's credentials", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const inner = { eventCancelled: vi.fn().mockRejectedValue(novuFailure()) } as unknown as Notifier;

    await new SupabaseRecordingNotifier(supabaseThatRecords(), inner).eventCancelled({
      recipientUserAccountId: "3",
      eventId: "9",
      eventRequestId: "42",
      eventName: "Pygmies Product Summit",
    });

    const logged = inspect(log.mock.calls, { depth: null });
    expect(logged).toContain("workflow_not_found");
    expect(logged).not.toContain(SECRET);
  });
});
