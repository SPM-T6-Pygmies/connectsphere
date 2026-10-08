import { describe, expect, it } from "vitest";

import type { CoordinatorEventStatus } from "./coordinator-event";
import { coordinatorWorkloads, isActiveEvent, reassignEventCoordinator } from "./coordinator-workload";
import { EventNotReassignableError } from "./errors";
import type { EventRequestStatus } from "./event-request";
import { userAccountId, type UserAccountId } from "./user-account";

const ALICE = userAccountId("coordinator-alice");
const BOB = userAccountId("coordinator-bob");

const request = (
  id: string,
  status: EventRequestStatus,
  assignedCoordinatorUserAccountId: UserAccountId | null,
) => ({ id, status, assignedCoordinatorUserAccountId });

const event = (
  id: string,
  status: CoordinatorEventStatus,
  assignedCoordinatorUserAccountId: UserAccountId | null,
) => ({ id, status, assignedCoordinatorUserAccountId });

describe("isActiveEvent (SPM-256)", () => {
  it.each([
    ["Planning", true],
    ["Blocked", true],
    ["Confirmed", true],
    ["Completed", false],
    ["Cancelled", false],
  ] as const)("AC2: counts a %s event as active: %s", (status, active) => {
    expect(isActiveEvent(status)).toBe(active);
  });
});

describe("coordinatorWorkloads (SPM-256)", () => {
  it("AC1: lists every coordinator, including one with nothing assigned", () => {
    expect(coordinatorWorkloads([ALICE, BOB], [], [])).toEqual([
      { coordinatorId: ALICE, requests: [], events: [] },
      { coordinatorId: BOB, requests: [], events: [] },
    ]);
  });

  it("AC1: files each request under the coordinator assigned to it", () => {
    const [alice, bob] = coordinatorWorkloads(
      [ALICE, BOB],
      [request("r1", "Under Review", ALICE), request("r2", "Returned", BOB)],
      [],
    );

    expect(alice.requests.map((r) => r.id)).toEqual(["r1"]);
    expect(bob.requests.map((r) => r.id)).toEqual(["r2"]);
  });

  it("AC2: lists the coordinator's Planning, Blocked and Confirmed events, not Completed or Cancelled ones", () => {
    const [alice] = coordinatorWorkloads(
      [ALICE],
      [],
      [
        event("e1", "Planning", ALICE),
        event("e2", "Blocked", ALICE),
        event("e3", "Confirmed", ALICE),
        event("e4", "Completed", ALICE),
        event("e5", "Cancelled", ALICE),
      ],
    );

    expect(alice.events.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("AC2: lists only requests still under review -- an Approved one is listed as its event", () => {
    const [alice] = coordinatorWorkloads(
      [ALICE],
      [
        request("submitted", "Submitted", ALICE),
        request("review", "Under Review", ALICE),
        request("returned", "Returned", ALICE),
        request("approved", "Approved", ALICE),
        request("rejected", "Rejected", ALICE),
        request("withdrawn", "Withdrawn", ALICE),
      ],
      [],
    );

    expect(alice.requests.map((r) => r.id)).toEqual(["submitted", "review", "returned"]);
  });

  it("leaves out work with no coordinator and work for someone who is not a coordinator", () => {
    const stranger = userAccountId("not-a-coordinator");

    const [alice] = coordinatorWorkloads(
      [ALICE],
      [request("r1", "Submitted", null), request("r2", "Under Review", stranger)],
      [event("e1", "Planning", null), event("e2", "Planning", stranger)],
    );

    expect(alice).toEqual({ coordinatorId: ALICE, requests: [], events: [] });
  });

  it("AC3: lists an event under its own current coordinator, not the request's", () => {
    const [alice, bob] = coordinatorWorkloads(
      [ALICE, BOB],
      [request("r1", "Approved", ALICE)],
      [event("e1", "Planning", BOB)],
    );

    expect(alice.events).toEqual([]);
    expect(bob.events.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("reassignEventCoordinator (SPM-257)", () => {
  it.each(["Planning", "Blocked", "Confirmed"] as const)(
    "AC1: moves a %s event to the new coordinator, keeping its status",
    (status) => {
      expect(reassignEventCoordinator(event("e1", status, ALICE), BOB)).toEqual(event("e1", status, BOB));
    },
  );

  it.each(["Completed", "Cancelled"] as const)(
    "AC1: refuses to reassign a %s event -- it is no longer being worked on",
    (status) => {
      expect(() => reassignEventCoordinator(event("e1", status, ALICE), BOB)).toThrow(
        new EventNotReassignableError(status),
      );
    },
  );
});
