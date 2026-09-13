import { InfoIcon } from "lucide-react";
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
import {
  buildViewAllEventCoordinators,
  buildViewOperationsEventRequest,
} from "@/composition/container";
import type { EventCoordinatorDetails } from "@/core/ports/inbound/view-all-event-coordinators";
import type { OperationsEventRequest } from "@/core/ports/inbound/view-all-event-requests";

import { FieldList } from "../field-list";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

function formatInstantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function preferredTimeOf(request: OperationsEventRequest): string | null {
  if (request.preferredStartTime === null && request.preferredEndTime === null) {
    return null;
  }

  if (request.preferredStartTime === null) {
    return `Until ${formatInstantTime(request.preferredEndTime!)}`;
  }

  if (request.preferredEndTime === null) {
    return `From ${formatInstantTime(request.preferredStartTime)}`;
  }

  return `${formatInstantTime(request.preferredStartTime)} – ${formatInstantTime(request.preferredEndTime)}`;
}

function coordinatorMeta(coordinator: EventCoordinatorDetails): string {
  return [coordinator.department, coordinator.availability].filter(Boolean).join(" · ") ||
    "No availability details supplied";
}

/** Loads the real Operations request and coordinator list for every route that opens this detail. */
export async function LoadedAssignDetail({
  id,
  origin = "queue",
}: {
  id: string;
  origin?: DetailOrigin;
}) {
  const [viewEventRequest, viewEventCoordinators] = await Promise.all([
    buildViewOperationsEventRequest(),
    buildViewAllEventCoordinators(),
  ]);
  const [eventRequestResult, eventCoordinatorsResult] = await Promise.all([
    viewEventRequest.execute({ id }),
    viewEventCoordinators.execute(),
  ]);

  if (eventRequestResult === null) {
    notFound();
  }

  return (
    <AssignDetail
      eventRequest={eventRequestResult.eventRequest}
      eventCoordinators={eventCoordinatorsResult.eventCoordinators}
      origin={origin}
    />
  );
}

export function AssignDetail({
  eventRequest,
  eventCoordinators,
  origin = "queue",
}: {
  eventRequest: OperationsEventRequest;
  eventCoordinators: readonly EventCoordinatorDetails[];
  origin?: DetailOrigin;
}) {
  const assignedCoordinator = eventCoordinators.find(
    (coordinator) =>
      coordinator.userAccountId === eventRequest.assignedCoordinatorUserAccountId,
  );
  const isAssigned = eventRequest.assignedCoordinatorUserAccountId !== null;
  const assignedCoordinatorName =
    assignedCoordinator?.name ??
    (eventRequest.assignedCoordinatorUserAccountId === null
      ? null
      : `Coordinator ${eventRequest.assignedCoordinatorUserAccountId}`);

  return (
    <StaffShell
      role="ops"
      crumbs={detailCrumbs(
        "ops",
        origin,
        isAssigned ? "Assigned" : "Unassigned",
        eventRequest.eventName,
        isAssigned ? "/staff/ops/assigned" : "/staff/ops",
      )}
    >
      <PageHeader
        title={eventRequest.eventName}
        description={`Client organisation ${eventRequest.clientOrganisationId} · requested by account ${eventRequest.requestingUserAccountId}`}
        actions={<StatusBadge status={eventRequest.status} />}
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
                  { label: "Preferred date", value: eventRequest.preferredDate },
                  { label: "Preferred time", value: preferredTimeOf(eventRequest) },
                  {
                    label: "Expected attendance",
                    value: eventRequest.expectedAttendance,
                  },
                  { label: "Room layout", value: eventRequest.roomLayoutPreferences },
                  { label: "Description", value: eventRequest.description },
                  { label: "Purpose", value: eventRequest.purpose },
                  {
                    label: "Venue requirements",
                    value: eventRequest.venueRequirements,
                  },
                  {
                    label: "Equipment requirements",
                    value: eventRequest.equipmentRequirements,
                  },
                  {
                    label: "Accessibility needs",
                    value: eventRequest.accessibilityNeeds,
                  },
                  {
                    label: "Registration requirements",
                    value: eventRequest.registrationRequirements,
                  },
                  { label: "Programme", value: eventRequest.generalProgramme },
                  {
                    label: "Other arrangements",
                    value: eventRequest.otherSpecialArrangements,
                  },
                  { label: "Decision record", value: eventRequest.decisionRecord },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>
                {isAssigned ? "Reassign coordinator" : "Assign a coordinator"}
              </CardTitle>
              <CardDescription>
                {assignedCoordinatorName
                  ? `Currently ${assignedCoordinatorName}.`
                  : "The coordinator becomes the client's main point of contact."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {eventCoordinators.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
                    No Event Coordinators are available.
                  </p>
                ) : (
                  eventCoordinators.map((coordinator) => {
                    const isCurrent =
                      eventRequest.assignedCoordinatorUserAccountId ===
                      coordinator.userAccountId;

                    return (
                      <label
                        key={coordinator.userAccountId}
                        className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                      >
                        <input
                          type="radio"
                          name="coordinator"
                          value={coordinator.userAccountId}
                          defaultChecked={isCurrent}
                          className="mt-1"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {coordinator.name}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {coordinatorMeta(coordinator)}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignmentNote">Note (optional)</Label>
                <Textarea
                  id="assignmentNote"
                  placeholder="Anything the coordinator should know before picking this up."
                />
              </div>

              <Button type="button" className="w-full" disabled>
                {isAssigned ? "Reassign" : "Assign coordinator"}
              </Button>
              <p className="text-muted-foreground text-xs">
                Assignment will be enabled when the assignment use case is connected.
              </p>
            </CardContent>
          </Card>

          {assignedCoordinatorName ? (
            <Card>
              <CardHeader>
                <CardTitle>Where it goes next</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {assignedCoordinatorName} reviews the request, asks the organiser for
                  anything unclear, and decides whether planning proceeds.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </StaffShell>
  );
}
