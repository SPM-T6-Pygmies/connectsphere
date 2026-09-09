import { describe, expect, it } from "vitest";

import {
  eventRequestDetails,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";

import { clientOrganisationId } from "./client-organisation";
import { IncompleteEventRequestError } from "./errors";
import {
  eventRequestAccessFor,
  isSubmittable,
  missingMandatoryFields,
  reassignResponsibleOrganiser,
  submitEventRequest,
  type EventRequest,
} from "./event-request";
import { userAccountId } from "./user-account";

const ORG_A = clientOrganisationId("org-a");
const ORG_B = clientOrganisationId("org-b");
const RESPONSIBLE = userAccountId("organiser-1");
const COLLEAGUE = userAccountId("organiser-2");
const NEW_RESPONSIBLE = userAccountId("organiser-3");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: RESPONSIBLE,
    ...overrides,
  });
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

describe("missingMandatoryFields", () => {
  it("reports nothing missing when every mandatory field is filled", () => {
    expect(missingMandatoryFields(eventRequestDetails())).toEqual([]);
    expect(isSubmittable(eventRequestDetails())).toBe(true);
  });

  it.each([
    ["eventName", { eventName: "" }],
    ["preferredDate", { preferredDate: null }],
    ["preferredTime", { preferredTime: null }],
    ["expectedAttendance", { expectedAttendance: null }],
  ] as const)("reports %s when it is absent", (field, override) => {
    expect(missingMandatoryFields(eventRequestDetails(override))).toEqual([field]);
  });

  it("treats whitespace as absent, so a space bar does not pass the gate", () => {
    expect(missingMandatoryFields(eventRequestDetails({ preferredTime: "   " }))).toEqual([
      "preferredTime",
    ]);
  });

  it("reports every missing field at once rather than the first", () => {
    const missing = missingMandatoryFields(
      eventRequestDetails({ eventName: "", preferredDate: null, expectedAttendance: null }),
    );

    expect(missing).toEqual(["eventName", "preferredDate", "expectedAttendance"]);
  });

  it("does not require the optional fields the customer left open (SPM-88)", () => {
    const bare = eventRequestDetails({
      description: null,
      purpose: null,
      venueRequirements: null,
      equipmentRequirements: null,
    });

    expect(isSubmittable(bare)).toBe(true);
  });

  it("counts zero expected attendance as given, not as absent", () => {
    expect(missingMandatoryFields(eventRequestDetails({ expectedAttendance: 0 }))).toEqual([]);
  });
});

describe("submitEventRequest", () => {
  const SUBMITTED_AT = new Date("2026-09-09T10:00:00.000Z");

  function submit(details = eventRequestDetails()) {
    return submitEventRequest({
      details,
      clientOrganisationId: ORG_A,
      responsibleOrganiserId: RESPONSIBLE,
      submittedAt: SUBMITTED_AT,
    });
  }

  it("produces a Submitted request carrying what was filled in", () => {
    const request = submit();

    expect(request.status).toBe("Submitted");
    expect(request.submittedAt).toEqual(SUBMITTED_AT);
    expect(request.details.eventName).toBe("Founders' Day");
    expect(request.responsibleOrganiserId).toBe(RESPONSIBLE);
    expect(request.clientOrganisationId).toBe(ORG_A);
  });

  it("refuses an incomplete request and names every missing field (AC3)", () => {
    expect(() => submit(eventRequestDetails({ eventName: "", preferredTime: null }))).toThrow(
      IncompleteEventRequestError,
    );

    try {
      submit(eventRequestDetails({ eventName: "", preferredTime: null }));
      expect.unreachable("submitEventRequest should have refused");
    } catch (error) {
      expect((error as IncompleteEventRequestError).missing).toEqual([
        "eventName",
        "preferredTime",
      ]);
    }
  });

  it("is submitted read-only: the Organiser keeps view access and loses edit (AC4)", () => {
    const submitted: EventRequest = eventRequestFixture({
      ...submit(),
      clientOrganisationId: ORG_A,
      responsibleOrganiserId: RESPONSIBLE,
    });

    expect(
      eventRequestAccessFor(submitted, {
        userAccountId: RESPONSIBLE,
        clientOrganisationId: ORG_A,
      }),
    ).toBe("view");
  });
});
