import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EventRequest } from "@/core/domain/event-request";

import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { FieldList } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

/** `h:mm am/pm`, in the viewer's own timezone -- for an instant, not a calendar date. */
function formatInstantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * SPM-32: everything the Organiser submitted, read-only. No decision,
 * clarification or edit controls of any kind -- those are SPM-33/34's job.
 */
export function AssignedRequestDetail({
  eventRequest,
  requestingOrganiserName,
  clientOrganisationName,
  origin = "queue",
}: {
  eventRequest: EventRequest;
  requestingOrganiserName: string;
  clientOrganisationName: string;
  origin?: DetailOrigin;
}) {
  const { details } = eventRequest;

  const preferredTime =
    details.preferredStartTime !== null && details.preferredEndTime !== null
      ? `${formatInstantTime(details.preferredStartTime)} – ${formatInstantTime(details.preferredEndTime)}`
      : null;

  return (
    <StaffShell
      role="coordinator"
      crumbs={detailCrumbs("coordinator", origin, "My requests", details.eventName)}
    >
      <PageHeader
        title={details.eventName}
        description={`${clientOrganisationName} · requested by ${requestingOrganiserName} · submitted ${eventRequest.submittedAt?.toISOString().slice(0, 10) ?? "—"}`}
        actions={<StatusBadge status={eventRequest.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The request as submitted</CardTitle>
              <CardDescription>
                Everything the Organiser supplied. Read-only -- a decision on this
                request is made elsewhere.
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
