import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  CoordinatorRequestState,
  CoordinatorSection,
  EventRequest,
} from "@/core/domain/event-request";

import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { FieldList } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { DecisionForm } from "./decision-form";
import { RequestStateBadge } from "./request-state-badge";

/** Where each of the Coordinator's sections sits in the rail. */
const SECTION_HOMES: Readonly<Record<CoordinatorSection, { label: string; href: string }>> = {
  requests: { label: "My requests", href: "/staff/coordinator" },
  events: { label: "My events", href: "/staff/coordinator/events" },
  archive: { label: "Archive", href: "/staff/coordinator/archive" },
};

/**
 * `h:mm am/pm` in Singapore time -- for an instant, not a calendar date.
 *
 * The zone is explicit because this renders on the server: without it the
 * instant is formatted in the server's zone, and a 9am request reads as 1am
 * to the Coordinator. The system is Singapore-time only (#36), so there is
 * one right answer rather than a per-viewer one.
 */
function formatInstantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * SPM-32: everything the Organiser submitted, read-only. SPM-34 adds the
 * decision alongside it: Approve/Reject while the request awaits this
 * Coordinator, and the outcome once it is decided. No clarification or edit
 * controls -- clarification is SPM-33's job, and a submitted request is
 * locked (#102).
 */
export function AssignedRequestDetail({
  eventRequest,
  requestingOrganiserName,
  clientOrganisationName,
  state,
  section,
  origin = "queue",
}: {
  eventRequest: EventRequest;
  requestingOrganiserName: string;
  clientOrganisationName: string;
  /** The Coordinator's reading of the status, from the use case. */
  state: CoordinatorRequestState | null;
  /** The section the request now lives under, from the use case. */
  section: CoordinatorSection;
  origin?: DetailOrigin;
}) {
  const { details } = eventRequest;

  // The rail entry the request now lives under, so the trail and the list pane
  // follow a decision instead of always pointing back to "My requests".
  const home = SECTION_HOMES[section];

  const preferredTime =
    details.preferredStartTime !== null && details.preferredEndTime !== null
      ? `${formatInstantTime(details.preferredStartTime)} – ${formatInstantTime(details.preferredEndTime)}`
      : null;

  return (
    <StaffShell
      role="coordinator"
      crumbs={detailCrumbs("coordinator", origin, home.label, details.eventName, home.href)}
      coordinatorSection={section}
      // Opened from the inbox, the rail stays on Notifications.
      activeSection={origin === "queue" ? section : undefined}
    >
      <PageHeader
        title={details.eventName}
        description={`${clientOrganisationName} · requested by ${requestingOrganiserName} · submitted ${eventRequest.submittedAt?.toISOString().slice(0, 10) ?? "—"}`}
        actions={state === null ? null : <RequestStateBadge state={state} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The request as submitted</CardTitle>
              <CardDescription>
                Everything the Organiser supplied, as submitted. The request itself
                cannot be edited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldList
                fields={[
                  { label: "Preferred date", value: details.preferredDate },
                  { label: "Preferred time", value: preferredTime },
                  { label: "Expected attendance", value: details.expectedAttendance },
                  { label: "Room layout", value: details.roomLayoutPreferences },
                  { label: "Description", value: details.description },
                  { label: "Purpose", value: details.purpose },
                  { label: "Venue requirements", value: details.venueRequirements },
                  { label: "Accessibility needs", value: details.accessibilityNeeds },
                  { label: "Equipment requirements", value: details.equipmentRequirements },
                  {
                    label: "Registration requirements",
                    value: details.registrationRequirements,
                  },
                  { label: "Programme", value: details.generalProgramme },
                  { label: "Other arrangements", value: details.otherSpecialArrangements },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {state === "awaiting-decision" ? (
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
                <CardDescription>
                  Approving lets planning begin but commits ConnectSphere to nothing
                  yet. Rejecting is final.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DecisionForm eventRequestId={eventRequest.id} />
              </CardContent>
            </Card>
          ) : state === "approved" || state === "rejected" ? (
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldList
                  columns={1}
                  fields={[
                    {
                      label: "Outcome",
                      value: state === "approved" ? "Approved -- planning can begin" : "Rejected",
                    },
                    {
                      label: state === "approved" ? "Note" : "Reason",
                      value: eventRequest.decisionRecord,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldList
                columns={1}
                fields={[
                  { label: "Client organisation", value: clientOrganisationName },
                  { label: "Requested by", value: requestingOrganiserName },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
