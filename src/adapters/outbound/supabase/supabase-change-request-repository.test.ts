import { describe, expect, it } from "vitest";

import { changeRequestId, type ChangeRequestItem } from "@/core/domain/change-request";
import {
  ChangeRequestAlreadyDecidedError,
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  ChangeRequestNotFoundError,
  EventRequestNotFoundError,
  InvalidChangeRequestDecisionError,
  InvalidChangeRequestError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { toChangeRequestItem, toRequestedChange } from "./change-request-mapper";
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

describe("SupabaseChangeRequestRepository decisions (SPM-100)", () => {
  const coordinator = userAccountId("2");

  it("AC1: reads each request's fields and decisions, spelling Rejected as Declined", async () => {
    const { client, calls } = fakeClient({
      coordinator_event_change_requests: {
        data: [
          {
            change_request_id: 4,
            created_at: "2026-10-27T02:00:00+00:00",
            items: [
              { field_name: "expected_attendance", requested_value: "350", decision: "Rejected", decision_reason: "Too many" },
              { field_name: "equipment_requirements", requested_value: null, decision: "Accepted", decision_reason: null },
            ],
          },
        ],
        error: null,
      },
    });

    const requests = await new SupabaseChangeRequestRepository(client).listForEvent(coordinator, eventId("1"));

    expect(requests).toEqual([
      {
        id: "4",
        submittedAt: new Date("2026-10-27T02:00:00Z"),
        items: [
          { change: { field: "expected_attendance", value: 350 }, decision: "Declined", reason: "Too many" },
          { change: { field: "equipment_requirements", value: null }, decision: "Accepted", reason: null },
        ],
      },
    ]);
    expect(calls).toEqual([
      { name: "coordinator_event_change_requests", args: { p_coordinator_user_account_id: 2, p_event_id: 1 } },
    ]);
  });

  it.each([
    ["times running to midnight", { field: "times", value: [{ date: "2026-12-01", start: "09:00", end: "24:00" }] }],
    ["venue requirements", { field: "venue_requirements", value: "Theatre seating" }],
    ["an attendance of 0", { field: "expected_attendance", value: 0 }],
    ["equipment requirements", { field: "equipment_requirements", value: "Two mics" }],
    ["equipment Not applicable", { field: "equipment_requirements", value: null }],
    [
      "registration settings",
      { field: "registration", value: { enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-25" } },
    ],
    ["registration Not applicable", { field: "registration", value: null }],
  ] as const)("reads back %s as it was sent", (_label, change) => {
    expect(toRequestedChange(toChangeRequestItem(change))).toEqual(change);
  });

  it("AC2, AC3: sends every decision, Declined as Rejected with its reason", async () => {
    const { client, calls } = fakeClient({ coordinator_decide_change_request: { data: null, error: null } });
    const items: ChangeRequestItem[] = [
      { change: { field: "expected_attendance", value: 350 }, decision: "Accepted", reason: null },
      { change: { field: "venue_requirements", value: "Theatre" }, decision: "Declined", reason: "No such hall" },
    ];

    await new SupabaseChangeRequestRepository(client).decide(coordinator, changeRequestId("4"), items);

    expect(calls).toEqual([
      {
        name: "coordinator_decide_change_request",
        args: {
          p_coordinator_user_account_id: 2,
          p_change_request_id: 4,
          p_decisions: [
            { field_name: "expected_attendance", decision: "Accepted", decision_reason: null },
            { field_name: "venue_requirements", decision: "Rejected", decision_reason: "No such hall" },
          ],
        },
      },
    ]);
  });

  it.each([
    ["CS095", ChangeRequestNotFoundError],
    ["CS096", ChangeRequestClosedError],
    ["CS097", ChangeRequestAlreadyDecidedError],
    ["CS098", InvalidChangeRequestDecisionError],
  ] as const)("turns %s into %o", async (code, errorType) => {
    const { client } = fakeClient({
      coordinator_decide_change_request: { data: null, error: { code, message: "refused" } },
    });

    await expect(
      new SupabaseChangeRequestRepository(client).decide(coordinator, changeRequestId("4"), []),
    ).rejects.toThrow(errorType);
  });

  it("refuses an id that is not a number as not found, without calling the database", async () => {
    const { client, calls } = fakeClient({});

    await expect(
      new SupabaseChangeRequestRepository(client).decide(coordinator, changeRequestId("abc"), []),
    ).rejects.toThrow(ChangeRequestNotFoundError);
    expect(calls).toEqual([]);
  });
});
