import { describe, expect, it } from "vitest";

import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryLeadEventRepository } from "@/adapters/outbound/in-memory/in-memory-lead-event-repository";
import { InMemoryUserAccountRepository } from "@/adapters/outbound/in-memory/in-memory-user-account-repository";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import type { LeadEvent } from "@/core/domain/coordinator-workload";
import {
  EventCoordinatorNotFoundError,
  EventNotFoundError,
  EventNotReassignableError,
  NotCoordinatorLeadError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";
import type { EventCoordinatorDetails } from "@/core/ports/outbound/user-account-repository";

import { ReassignEventCoordinatorUseCase } from "./reassign-event-coordinator";

const LEAD = userAccountId("lead-1");
const OLD_COORDINATOR = userAccountId("coordinator-1");
const NEW_COORDINATOR = userAccountId("coordinator-2");
const ORGANISER = userAccountId("organiser-1");
const ORG = clientOrganisationId("org-a");

function coordinator(id: string): EventCoordinatorDetails {
  return {
    userAccountId: id,
    name: id,
    contactDetails: null,
    communicationPreferences: null,
    department: null,
    availability: null,
    clientOrganisationId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function event(status: CoordinatorEventStatus = "Planning"): LeadEvent {
  return {
    id: eventId("9"),
    eventRequestId: eventRequestId("4"),
    name: "Venue Safety Review",
    description: null,
    status,
    preferredDate: "2026-11-04",
    expectedAttendance: 40,
    statedEquipmentNeeds: null,
    clientOrganisationId: ORG,
    owningOrganiserUserAccountId: ORGANISER,
    assignedCoordinatorUserAccountId: OLD_COORDINATOR,
  };
}

function build(events: readonly LeadEvent[] = [event()], leads = [LEAD]) {
  const leadEvents = new InMemoryLeadEventRepository({ events, leads });
  const notifier = new RecordingNotifier();
  const useCase = new ReassignEventCoordinatorUseCase({
    leadEvents,
    userAccounts: new InMemoryUserAccountRepository({
      names: new Map([[NEW_COORDINATOR, "Arjun Nair"]]),
      eventCoordinators: [coordinator(OLD_COORDINATOR), coordinator(NEW_COORDINATOR)],
    }),
    clientOrganisations: new InMemoryClientOrganisationRepository(new Map([[ORG, "Acme Holdings"]])),
    notifier,
  });
  return { useCase, leadEvents, notifier };
}

const reassign = { eventId: "9", eventCoordinatorUserAccountId: NEW_COORDINATOR, leadUserAccountId: LEAD };

describe("ReassignEventCoordinatorUseCase (SPM-257)", () => {
  it.each(["Planning", "Blocked", "Confirmed"] as const)(
    "AC1: moves a %s event to the new coordinator at once, keeping its status",
    async (status) => {
      const { useCase, leadEvents } = build([event(status)]);

      await expect(useCase.execute(reassign)).resolves.toEqual({
        eventId: "9",
        assignedCoordinatorUserAccountId: NEW_COORDINATOR,
        changed: true,
      });
      expect(await leadEvents.findById(LEAD, eventId("9"))).toMatchObject({
        status,
        assignedCoordinatorUserAccountId: NEW_COORDINATOR,
      });
    },
  );

  it("AC2: takes the event off the previous coordinator and gives it to the new one", async () => {
    const { useCase, leadEvents } = build();

    await useCase.execute(reassign);

    const events = await leadEvents.listAll(LEAD);
    expect(events.filter((e) => e.assignedCoordinatorUserAccountId === OLD_COORDINATOR)).toEqual([]);
    expect(events.filter((e) => e.assignedCoordinatorUserAccountId === NEW_COORDINATOR)).toHaveLength(1);
  });

  it("AC3: tells the new coordinator, linking the event, and the Organiser -- not the previous coordinator", async () => {
    const { useCase, notifier } = build();

    await useCase.execute(reassign);

    expect(notifier.coordinatorAssignments).toEqual([
      {
        recipientUserAccountId: NEW_COORDINATOR,
        eventRequestId: "4",
        eventId: "9",
        eventName: "Venue Safety Review",
        clientOrganisationName: "Acme Holdings",
        preferredDate: "2026-11-04",
        preferredSlots: [],
      },
    ]);
    expect(notifier.organiserCoordinatorAssignments).toEqual([
      {
        recipientUserAccountId: ORGANISER,
        eventRequestId: "4",
        eventName: "Venue Safety Review",
        coordinatorName: "Arjun Nair",
      },
    ]);
  });

  it("AC4: records who reassigned the event, and from and to whom", async () => {
    const { useCase, leadEvents } = build();

    await useCase.execute(reassign);

    expect(leadEvents.reassignments).toEqual([
      { eventId: "9", from: OLD_COORDINATOR, to: NEW_COORDINATOR, by: LEAD },
    ]);
  });

  it.each(["Completed", "Cancelled"] as const)(
    "AC1: refuses a %s event, and stores and sends nothing",
    async (status) => {
      const { useCase, leadEvents, notifier } = build([event(status)]);

      await expect(useCase.execute(reassign)).rejects.toEqual(new EventNotReassignableError(status));
      expect(leadEvents.reassignments).toEqual([]);
      expect(notifier.coordinatorAssignments).toEqual([]);
      expect(notifier.organiserCoordinatorAssignments).toEqual([]);
    },
  );

  it("changes, records and sends nothing when the event already has that coordinator", async () => {
    const { useCase, leadEvents, notifier } = build();

    await expect(
      useCase.execute({ ...reassign, eventCoordinatorUserAccountId: OLD_COORDINATOR }),
    ).resolves.toEqual({ eventId: "9", assignedCoordinatorUserAccountId: OLD_COORDINATOR, changed: false });
    expect(leadEvents.reassignments).toEqual([]);
    expect(notifier.coordinatorAssignments).toEqual([]);
    expect(notifier.organiserCoordinatorAssignments).toEqual([]);
  });

  it("refuses an event that does not exist", async () => {
    const { useCase } = build([]);

    await expect(useCase.execute(reassign)).rejects.toEqual(new EventNotFoundError("9"));
  });

  it("refuses a user account that is not an Event Coordinator, and stores nothing", async () => {
    const { useCase, leadEvents } = build();

    await expect(
      useCase.execute({ ...reassign, eventCoordinatorUserAccountId: "organiser-1" }),
    ).rejects.toBeInstanceOf(EventCoordinatorNotFoundError);
    expect(leadEvents.reassignments).toEqual([]);
  });

  it("refuses anyone who is not an Event Coordinator Lead", async () => {
    const { useCase } = build([event()], []);

    await expect(useCase.execute(reassign)).rejects.toBeInstanceOf(NotCoordinatorLeadError);
  });
});
