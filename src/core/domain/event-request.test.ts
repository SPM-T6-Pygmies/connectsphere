import { describe, expect, it } from "vitest";

import { clientOrganisationId } from "./client-organisation";
import {
  eventRequestAccessFor,
  eventRequestId,
  reassignResponsibleOrganiser,
  type EventRequest,
} from "./event-request";
import { userAccountId } from "./user-account";

const ORG_A = clientOrganisationId("org-a");
const ORG_B = clientOrganisationId("org-b");
const RESPONSIBLE = userAccountId("organiser-1");
const COLLEAGUE = userAccountId("organiser-2");
const NEW_RESPONSIBLE = userAccountId("organiser-3");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return {
    id: eventRequestId("request-1"),
    eventName: "Founders' Day",
    status: "Draft",
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: RESPONSIBLE,
    ...overrides,
  };
}

describe("eventRequestAccessFor", () => {
  it("grants the responsible Organiser edit access while the request is Draft", () => {
    expect(
      eventRequestAccessFor(request(), { userAccountId: RESPONSIBLE, clientOrganisationId: ORG_A }),
    ).toBe("edit");
  });

  it.each([
    "Submitted",
    "Under Review",
    "Approved",
    "Rejected",
    "Returned",
    "Withdrawn",
  ] as const)("narrows the responsible Organiser to view-only once the request is %s (#102)", (status) => {
    expect(
      eventRequestAccessFor(request({ status }), {
        userAccountId: RESPONSIBLE,
        clientOrganisationId: ORG_A,
      }),
    ).toBe("view");
  });

  it("grants a same-organisation colleague view but never edit, even in Draft", () => {
    expect(
      eventRequestAccessFor(request(), { userAccountId: COLLEAGUE, clientOrganisationId: ORG_A }),
    ).toBe("view");
  });

  it("grants a same-organisation colleague view-only after submission too", () => {
    expect(
      eventRequestAccessFor(request({ status: "Submitted" }), {
        userAccountId: COLLEAGUE,
        clientOrganisationId: ORG_A,
      }),
    ).toBe("view");
  });

  it("grants an unrelated client organisation neither view nor edit", () => {
    expect(
      eventRequestAccessFor(request(), { userAccountId: COLLEAGUE, clientOrganisationId: ORG_B }),
    ).toBe("none");
  });

  it("refuses the responsible Organiser too, once they belong to an unrelated organisation", () => {
    expect(
      eventRequestAccessFor(request(), { userAccountId: RESPONSIBLE, clientOrganisationId: ORG_B }),
    ).toBe("none");
  });
});

describe("reassignResponsibleOrganiser", () => {
  it("replaces the responsible Organiser", () => {
    const reassigned = reassignResponsibleOrganiser(request(), NEW_RESPONSIBLE);

    expect(reassigned.responsibleOrganiserId).toBe(NEW_RESPONSIBLE);
  });

  it("removes the outgoing Organiser's edit access and grants the new one's", () => {
    const reassigned = reassignResponsibleOrganiser(request(), NEW_RESPONSIBLE);
    const organisation = { clientOrganisationId: ORG_A };

    expect(
      eventRequestAccessFor(reassigned, { ...organisation, userAccountId: RESPONSIBLE }),
    ).toBe("view");
    expect(
      eventRequestAccessFor(reassigned, { ...organisation, userAccountId: NEW_RESPONSIBLE }),
    ).toBe("edit");
  });
});
