import { InMemoryEventCoordinatorDirectory } from "./in-memory-event-coordinator-directory";
import { userAccountId, type UserAccount } from "@/core/domain/user-account";

const DEMO_EVENT_COORDINATORS: readonly UserAccount[] = [
  {
    id: userAccountId("4"),
    name: "Amara Sithole",
    contactDetails: null,
    communicationPreferences: null,
    department: "Event Coordination",
    availability: "Available",
    clientOrganisationId: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    id: userAccountId("5"),
    name: "Jonas Berg",
    contactDetails: null,
    communicationPreferences: null,
    department: "Event Coordination",
    availability: "Available",
    clientOrganisationId: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  },
];

export const demoEventCoordinatorDirectory = new InMemoryEventCoordinatorDirectory(
  DEMO_EVENT_COORDINATORS,
);
