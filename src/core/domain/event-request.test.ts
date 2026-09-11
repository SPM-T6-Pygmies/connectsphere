import { describe, expect, it } from "vitest";

import {
  eventRequestDetails,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";

import { clientOrganisationId } from "./client-organisation";
import {
  IncompleteEventRequestError,
  PreferredDateNotInFutureError,
  PreferredEndTimeNotAfterStartError,
} from "./errors";
import {
  eventRequestAccessFor,
  isSubmittable,
  missingMandatoryFields,
  reassignResponsibleOrganiser,
  saveEventRequestDraft,
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
    ["preferredStartTime", { preferredStartTime: null }],
    ["preferredEndTime", { preferredEndTime: null }],
    ["expectedAttendance", { expectedAttendance: null }],
  ] as const)("reports %s when it is absent", (field, override) => {
    expect(missingMandatoryFields(eventRequestDetails(override))).toEqual([field]);
  });

  it("treats whitespace as absent, so a space bar does not pass the gate", () => {
    expect(missingMandatoryFields(eventRequestDetails({ preferredStartTime: "   " }))).toEqual([
      "preferredStartTime",
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
      // Fixed rather than the machine's own zone, so "today" is deterministic
      // regardless of where the test runs.
      organiserTimeZone: "UTC",
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
    expect(() =>
      submit(eventRequestDetails({ eventName: "", preferredStartTime: null })),
    ).toThrow(IncompleteEventRequestError);

    try {
      submit(eventRequestDetails({ eventName: "", preferredStartTime: null }));
      expect.unreachable("submitEventRequest should have refused");
    } catch (error) {
      expect((error as IncompleteEventRequestError).missing).toEqual([
        "eventName",
        "preferredStartTime",
      ]);
    }
  });

  it("refuses a preferred date that is not later than today", () => {
    expect(() => submit(eventRequestDetails({ preferredDate: "2026-09-09" }))).toThrow(
      PreferredDateNotInFutureError,
    );
    expect(() => submit(eventRequestDetails({ preferredDate: "2026-09-01" }))).toThrow(
      PreferredDateNotInFutureError,
    );
  });

  it("uses the Organiser's own timezone for \"today\", not the server's", () => {
    // SUBMITTED_AT is 2026-09-09T10:00 UTC. In Kiritimati (UTC+14) that's
    // already 2026-09-10 -- a date UTC alone would still call "future" is
    // refused once the Organiser's own zone decides "today".
    expect(() =>
      submitEventRequest({
        details: eventRequestDetails({ preferredDate: "2026-09-10" }),
        clientOrganisationId: ORG_A,
        responsibleOrganiserId: RESPONSIBLE,
        submittedAt: SUBMITTED_AT,
        organiserTimeZone: "Pacific/Kiritimati",
      }),
    ).toThrow(PreferredDateNotInFutureError);

    // The same instant, seen from UTC-12, is still 2026-09-08 -- a date UTC
    // alone would refuse as "not later than today" is accepted.
    expect(() =>
      submitEventRequest({
        details: eventRequestDetails({ preferredDate: "2026-09-09" }),
        clientOrganisationId: ORG_A,
        responsibleOrganiserId: RESPONSIBLE,
        submittedAt: SUBMITTED_AT,
        organiserTimeZone: "Etc/GMT+12",
      }),
    ).not.toThrow();
  });

  it("refuses a preferred end time that is not after the preferred start time", () => {
    expect(() =>
      submit(
        eventRequestDetails({ preferredStartTime: "2026-11-04T09:00", preferredEndTime: "2026-11-04T09:00" }),
      ),
    ).toThrow(PreferredEndTimeNotAfterStartError);

    expect(() =>
      submit(
        eventRequestDetails({ preferredStartTime: "2026-11-04T09:00", preferredEndTime: "2026-11-04T08:00" }),
      ),
    ).toThrow(PreferredEndTimeNotAfterStartError);
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

describe("saveEventRequestDraft", () => {
  function draft(details = eventRequestDetails()) {
    return saveEventRequestDraft({
      details,
      clientOrganisationId: ORG_A,
      responsibleOrganiserId: RESPONSIBLE,
    });
  }

  it("produces an unsubmitted Draft carrying whatever was filled in (AC1)", () => {
    const request = draft();

    expect(request.status).toBe("Draft");
    expect(request.submittedAt).toBeNull();
    expect(request.responsibleOrganiserId).toBe(RESPONSIBLE);
    expect(request.clientOrganisationId).toBe(ORG_A);
  });

  it("does not enforce mandatory-field completeness (SPM-93)", () => {
    expect(() =>
      draft(
        eventRequestDetails({
          preferredDate: null,
          preferredStartTime: null,
          preferredEndTime: null,
          expectedAttendance: null,
        }),
      ),
    ).not.toThrow();
  });

  it("does not enforce the preferred-date-in-future or end-after-start rules", () => {
    expect(() =>
      draft(
        eventRequestDetails({
          preferredDate: "2020-01-01",
          preferredStartTime: "2020-01-01T17:00",
          preferredEndTime: "2020-01-01T09:00",
        }),
      ),
    ).not.toThrow();
  });

  it("still refuses a request with no name, matching the store's own constraint", () => {
    expect(() => draft(eventRequestDetails({ eventName: "" }))).toThrow(
      IncompleteEventRequestError,
    );
    expect(() => draft(eventRequestDetails({ eventName: "   " }))).toThrow(
      IncompleteEventRequestError,
    );
  });

  it("keeps the responsible Organiser in edit access while it stays a Draft", () => {
    const request: EventRequest = eventRequestFixture({
      ...draft(),
      clientOrganisationId: ORG_A,
      responsibleOrganiserId: RESPONSIBLE,
    });

    expect(
      eventRequestAccessFor(request, { userAccountId: RESPONSIBLE, clientOrganisationId: ORG_A }),
    ).toBe("edit");
  });
});
