import { forbidden } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildViewAllEventCoordinators,
  buildViewOperationsEventRequest,
  getStaffWorkspaces,
} from "@/composition/container";
import type { EventCoordinatorDetails } from "@/core/use-cases/view-all-event-coordinators";
import type { OperationsEventRequest } from "@/core/use-cases/operations-event-request";

import { FieldList } from "../field-list";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";
import { AssignEventCoordinatorForm } from "./assign-event-coordinator-form";

/** Loads the real Operations request and coordinator list for every route that opens this detail. */
export async function LoadedAssignDetail({
  id,
  origin = "queue",
}: {
  id: string;
  origin?: DetailOrigin;
}) {
  // Checked here rather than left to `StaffShell`: the shell only runs once
  // this has rendered, and by then the request and every coordinator would
  // already have been read for someone who may not open Operations.
  if (!(await getStaffWorkspaces()).includes("lead")) {
    forbidden();
  }

  const [viewEventRequest, viewEventCoordinators] = await Promise.all([
    buildViewOperationsEventRequest(),
    buildViewAllEventCoordinators(),
  ]);
  const [eventRequestResult, eventCoordinatorsResult] = await Promise.all([
    viewEventRequest.execute({ id }),
    viewEventCoordinators.execute(),
  ]);

  if (eventRequestResult === null) {
    forbidden();
  }

  return (
    <AssignDetail
      eventRequest={eventRequestResult.eventRequest}
      canAssignCoordinator={eventRequestResult.canAssignCoordinator}
      eventCoordinators={eventCoordinatorsResult.eventCoordinators}
      origin={origin}
    />
  );
}

export function AssignDetail({
  eventRequest,
  canAssignCoordinator,
  eventCoordinators,
  origin = "queue",
}: {
  eventRequest: OperationsEventRequest;
  canAssignCoordinator: boolean;
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
      role="lead"
      activeSection={
        origin === "queue" ? (isAssigned ? "assigned" : "unassigned") : undefined
      }
      crumbs={detailCrumbs(
        "lead",
        origin,
        isAssigned ? "Assigned" : "Unassigned",
        eventRequest.eventName,
        isAssigned ? "/staff/lead/assigned" : "/staff/lead",
      )}
    >
      <PageHeader
        title={eventRequest.eventName}
        description={`${eventRequest.clientOrganisationName || `Client organisation ${eventRequest.clientOrganisationId}`} · requested by account ${eventRequest.requestingUserAccountId}`}
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
                  {
                    label: "Preferred slots",
                    value: eventRequest.preferredSlots.join(", ") || null,
                  },
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
            <CardContent>
              <AssignEventCoordinatorForm
                key={eventRequest.id}
                eventRequestId={eventRequest.id}
                eventRequestName={eventRequest.eventName}
                currentCoordinatorUserAccountId={
                  eventRequest.assignedCoordinatorUserAccountId
                }
                eventRequestStatus={eventRequest.status}
                assignmentAllowed={canAssignCoordinator}
                eventCoordinators={eventCoordinators}
              />
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
