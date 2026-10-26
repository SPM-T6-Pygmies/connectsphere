import { describe, expect, it } from "vitest";

import {
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  EventRequestNotFoundError,
  InvalidChangeRequestError,
} from "@/core/domain/errors";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import type { SupabaseServerClient } from "./client";
import { SupabaseChangeRequestRepository } from "./supabase-change-request-repository";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

/** A client whose `rpc` answers from a table of function name to result, and remembers the calls. */
function fakeClient(answers: Record<string, RpcResult>) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return answers[name] ?? { data: null, error: { message: `unexpected call to ${name}` } };
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

describe("SupabaseChangeRequestRepository (SPM-52)", () => {
  it("reads the event opened from the request through organiser_change_request_target", async () => {
    const { client, calls } = fakeClient({
      organiser_change_request_target: {
        data: [{ event_id: 2, status: "Confirmed", owning_organiser_user_account_id: 6, has_open_change_request: true }],
        error: null,
      },
    });

    const target = await new SupabaseChangeRequestRepository(client).findTarget(eventRequestId("7"));

    expect(target).toEqual({
      eventId: "2",
      status: "Confirmed",
      owningOrganiserUserAccountId: "6",
      hasOpenChangeRequest: true,
    });
    expect(calls).toEqual([{ name: "organiser_change_request_target", args: { p_event_request_id: 7 } }]);
  });

  it("reads no event for a request that was never approved", async () => {
    const { client } = fakeClient({ organiser_change_request_target: { data: [], error: null } });

    expect(await new SupabaseChangeRequestRepository(client).findTarget(eventRequestId("7"))).toBeNull();
  });

  it("AC1: sends each field with its value as text, and Not applicable as null", async () => {
    const { client, calls } = fakeClient({ submit_change_request: { data: 11, error: null } });

    await new SupabaseChangeRequestRepository(client).submit({
      eventRequestId: eventRequestId("7"),
      requestedBy: userAccountId("6"),
      changes: [
        { field: "times", value: [{ date: "2026-12-01", start: "09:00", end: "12:00" }] },
        { field: "venue_requirements", value: "Theatre seating" },
        { field: "expected_attendance", value: 150 },
        { field: "equipment_requirements", value: null },
        { field: "registration", value: { enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-25" } },
      ],
    });

    expect(calls).toEqual([
      {
        name: "submit_change_request",
        args: {
          p_event_request_id: 7,
          p_requesting_user_account_id: 6,
          p_items: [
            { field_name: "times", requested_value: '[{"date":"2026-12-01","start":"09:00","end":"12:00"}]' },
            { field_name: "venue_requirements", requested_value: "Theatre seating" },
            { field_name: "expected_attendance", requested_value: "150" },
            { field_name: "equipment_requirements", requested_value: null },
            {
              field_name: "registration",
              requested_value: '{"enabled":true,"opensOn":"2026-11-01","closesOn":"2026-11-25"}',
            },
          ],
        },
      },
    ]);
  });

  it.each([
    ["CS090", EventRequestNotFoundError],
    ["CS091", ChangeRequestClosedError],
    ["CS092", ChangeRequestAlreadyOpenError],
    ["CS093", InvalidChangeRequestError],
  ])("maps the database's refusal %s to the domain's", async (code, expected) => {
    const { client } = fakeClient({ submit_change_request: { data: null, error: { code, message: "refused" } } });

    await expect(
      new SupabaseChangeRequestRepository(client).submit({
        eventRequestId: eventRequestId("7"),
        requestedBy: userAccountId("6"),
        changes: [{ field: "expected_attendance", value: 150 }],
      }),
    ).rejects.toThrow(expected);
  });
});
