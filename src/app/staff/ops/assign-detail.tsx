import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { coordinatorEvents, eventById, PEOPLE } from "@/lib/wireframe";

import { ActivityPanel } from "../activity-panel";
import { FieldList } from "../field-list";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

const COORDINATORS = [PEOPLE.coordinatorAmara, PEOPLE.coordinatorJonas];

export function AssignDetail({
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
  const assigned = request.assignedCoordinator;

  return (
    <StaffShell
      role="ops"
      crumbs={detailCrumbs("ops", origin, "Assignment queue", request.eventName)}
    >
      <PageHeader
        title={request.eventName}
        description={`${request.clientOrganisation} · requested by ${request.requestedBy.name}`}
        actions={<StatusBadge status={request.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The request</CardTitle>
              <CardDescription>
                Enough to choose a coordinator. The coordinator does the full
                review.
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
                  { label: "Description", value: request.description },
                  { label: "Purpose", value: request.purpose },
                  {
                    label: "Venue requirements",
                    value: request.venueRequirements,
                  },
                  {
                    label: "Equipment requirements",
                    value: request.equipmentRequirements,
                  },
                  {
                    label: "Accessibility needs",
                    value: request.accessibilityNeeds,
                  },
                  {
                    label: "Registration requirements",
                    value: request.registrationRequirements,
                  },
                ]}
              />
            </CardContent>
          </Card>
          <ActivityPanel eventId={event.id} section="overview" />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {assigned ? "Reassign coordinator" : "Assign a coordinator"}
              </CardTitle>
              <CardDescription>
                {assigned
                  ? `Currently ${assigned.name}.`
                  : "The coordinator becomes the client's main point of contact."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {COORDINATORS.map((coordinator) => {
                  const load = coordinatorEvents(coordinator).length;
                  const isCurrent = assigned?.id === coordinator.id;

                  return (
                    <label
                      key={coordinator.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                    >
                      <input
                        type="radio"
                        name="coordinator"
                        defaultChecked={isCurrent}
                        className="mt-1"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {coordinator.name}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {coordinator.department} ·{" "}
                          {load === 1 ? "1 event" : `${load} events`} in flight
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignmentNote">Note (optional)</Label>
                <Textarea
                  id="assignmentNote"
                  placeholder="Anything the coordinator should know before picking this up."
                />
              </div>

              <Button className="w-full">
                {assigned ? "Reassign" : "Assign coordinator"}
              </Button>
            </CardContent>
          </Card>

          <Alert variant="info">
            <InfoIcon />
            <AlertTitle>Assignment is a write, not a workflow</AlertTitle>
            <AlertDescription>
              <p>
                There is no approval chain, no acceptance step and no way for a
                coordinator to decline. A coordinator can hold several events at
                once, and no workload cap is defined — the counts above are
                context, not a limit the system enforces.
              </p>
            </AlertDescription>
          </Alert>

          {assigned ? (
            <Card>
              <CardHeader>
                <CardTitle>Where it goes next</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {assigned.name} reviews the request, asks the organiser for
                  anything unclear, and decides whether planning proceeds.
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href={`/staff/coordinator/${event.id}`}>
                    Open the coordinator&apos;s view
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </StaffShell>
  );
}
