import { CheckIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { eventById, type EventRecord } from "@/lib/wireframe";

import { ActivityPanel } from "../activity-panel";
import { FieldList } from "../field-list";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

/**
 * How far along the 14-step process this request has travelled.
 *
 * The organiser is external, so this deliberately reads as plain progress
 * rather than exposing internal planning state -- the brief asks that a user
 * understand where their event stands without knowing ConnectSphere's
 * internal processes.
 */
function timeline(event: EventRecord) {
  const request = event.request;
  const assigned = request.assignedCoordinator !== null;
  const reviewed =
    request.status === "Under Review" ||
    request.status === "Approved" ||
    request.status === "Rejected" ||
    request.status === "Returned";
  const approved = request.status === "Approved";

  return [
    { label: "Submitted", done: request.submittedAt !== null, detail: request.submittedAt ?? "Not submitted" },
    {
      label: "Coordinator assigned",
      done: assigned,
      detail: request.assignedCoordinator?.name ?? "Awaiting assignment",
    },
    { label: "Under review", done: reviewed, detail: reviewed ? "Reviewed by your coordinator" : "Not started" },
    {
      label: "Approved to plan",
      done: approved,
      detail: approved ? "Planning can proceed" : "Not yet approved",
    },
    {
      label: "Arrangements confirmed",
      done: event.status === "Confirmed" || event.status === "Completed",
      detail:
        event.status === "Confirmed" || event.status === "Completed"
          ? "Venue, equipment and support are in place"
          : "In progress",
    },
  ];
}

export function RequestDetail({
  id,
  origin = "queue",
}: {
  id: string;
  origin?: DetailOrigin;
}) {
  const event = eventById(id);

  if (!event) {
    notFound();
  }

  const request = event.request;

  return (
    <StaffShell
      role="requester"
      crumbs={detailCrumbs(
        "requester",
        origin,
        "Submitted",
        request.eventName,
        "/staff/requester/submitted",
      )}
    >
      <PageHeader
        title={request.eventName}
        description={`Submitted ${request.submittedAt ?? "—"} · ${request.clientOrganisation}`}
        actions={<StatusBadge status={request.status} />}
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
                  { label: "Category", value: request.categoryType },
                  { label: "Preferred date", value: request.preferredDate },
                  { label: "Preferred time", value: request.preferredTime },
                  {
                    label: "Expected attendance",
                    value: request.expectedAttendance,
                  },
                  { label: "Room layout", value: request.roomLayoutPreferences },
                  { label: "Description", value: request.description },
                  { label: "Purpose", value: request.purpose },
                  {
                    label: "Venue requirements",
                    value: request.venueRequirements,
                  },
                  {
                    label: "Accessibility needs",
                    value: request.accessibilityNeeds,
                  },
                  {
                    label: "Equipment requirements",
                    value: request.equipmentRequirements,
                  },
                  {
                    label: "Registration requirements",
                    value: request.registrationRequirements,
                  },
                  { label: "Programme", value: request.generalProgramme },
                  {
                    label: "Other arrangements",
                    value: request.otherSpecialArrangements,
                  },
                ]}
              />
            </CardContent>
          </Card>

          {request.decisionRecord ? (
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">
                  {request.decisionRecord}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <ActivityPanel
            eventId={event.id}
            role="requester"
            section="overview"
            commentsOnly
          />
        </div>

        <div className="space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {timeline(event).map((entry) => (
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

          {event.status === "Confirmed" || event.status === "Completed" ? (
            <Card>
              <CardHeader>
                <CardTitle>Confirmed arrangements</CardTitle>
                <CardDescription>
                  Visible to you now that the event is confirmed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldList
                  columns={1}
                  fields={[
                    { label: "Venue", value: event.booking?.venue.location },
                    {
                      label: "Date",
                      value: event.booking
                        ? `${event.booking.slotDate} · ${event.booking.slots.join(", ")}`
                        : null,
                    },
                    { label: "Coordinator", value: event.coordinator?.name },
                    {
                      label: "Registration",
                      value: event.registrationEnabled
                        ? `Open ${event.registrationOpenDate} to ${event.registrationCloseDate}`
                        : "Not enabled",
                    },
                  ]}
                />
              </CardContent>
            </Card>
          ) : (
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
                  {event.status}
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
