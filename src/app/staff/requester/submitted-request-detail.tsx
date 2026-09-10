import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EventRequest } from "@/core/domain/event-request";

import { FieldList } from "../field-list";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

/** `h:mm am/pm`, in the viewer's own timezone -- for an instant, not a calendar date. */
function formatInstantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * How far along the request has travelled.
 *
 * Coordinator assignment and arrangement confirmation have no adapter yet
 * (SPM-39, SPM-73), so those steps read as not-yet-started rather than
 * inventing a coordinator or a booking the store does not have.
 */
function timeline(request: EventRequest) {
  const reviewed =
    request.status === "Under Review" ||
    request.status === "Approved" ||
    request.status === "Rejected" ||
    request.status === "Returned";
  const approved = request.status === "Approved";

  return [
    {
      label: "Submitted",
      done: request.submittedAt !== null,
      detail: request.submittedAt?.toISOString().slice(0, 10) ?? "Not submitted",
    },
    { label: "Coordinator assigned", done: false, detail: "Awaiting assignment" },
    { label: "Under review", done: reviewed, detail: reviewed ? "Reviewed by your coordinator" : "Not started" },
    {
      label: "Approved to plan",
      done: approved,
      detail: approved ? "Planning can proceed" : "Not yet approved",
    },
    { label: "Arrangements confirmed", done: false, detail: "In progress" },
  ];
}

export function SubmittedRequestDetail({
  eventRequest,
  origin = "queue",
}: {
  eventRequest: EventRequest;
  origin?: DetailOrigin;
}) {
  const { details } = eventRequest;

  const preferredTime =
    details.preferredStartTime !== null && details.preferredEndTime !== null
      ? `${formatInstantTime(details.preferredStartTime)} – ${formatInstantTime(details.preferredEndTime)}`
      : null;

  return (
    <StaffShell
      role="requester"
      crumbs={detailCrumbs("requester", origin, "My requests", details.eventName)}
    >
      <PageHeader
        title={details.eventName}
        description={`Submitted ${eventRequest.submittedAt?.toISOString().slice(0, 10) ?? "—"}`}
        actions={<StatusBadge status={eventRequest.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your request</CardTitle>
              <CardDescription>
                As submitted. Changes after submission go through your
                coordinator rather than being edited here.
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
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {timeline(eventRequest).map((entry) => (
                  <li key={entry.label} className="flex gap-3">
                    <span
                      className={
                        entry.done
                          ? "bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full"
                          : "border-muted-foreground/30 flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed"
                      }
                    >
                      {entry.done ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-muted-foreground text-xs">
                        {entry.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arrangements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Venue and equipment details become visible once your
                coordinator confirms the event. Approval means planning can
                start; it does not commit a venue.
              </p>
              <Badge variant="outline" className="mt-3">
                {eventRequest.status}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
