import { forbidden } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildViewAllEventCoordinators,
  buildViewLeadEvent,
  getCurrentCoordinatorLead,
} from "@/composition/container";

import { detailCrumbs } from "../../../detail-origin";
import { FieldList } from "../../../field-list";
import { PageHeader, StaffShell } from "../../../staff-shell";
import { StatusBadge } from "../../../status-badge";
import { ReassignEventCoordinatorForm } from "../reassign-event-coordinator-form";

/** SPM-257: an event as the Lead opens it, with the form to hand it to another coordinator. */
export default async function LeadEventPage({ params }: PageProps<"/staff/lead/events/[id]">) {
  const { id } = await params;

  // Checked before anything is read, as on the request page: the shell's own
  // check only runs once this has rendered.
  const lead = await getCurrentCoordinatorLead();
  if (lead === null) {
    forbidden();
  }

  const [viewLeadEvent, viewEventCoordinators] = await Promise.all([
    buildViewLeadEvent(),
    buildViewAllEventCoordinators(),
  ]);
  const [result, { eventCoordinators }] = await Promise.all([
    viewLeadEvent.execute({ eventId: id, leadUserAccountId: lead.userAccountId }),
    viewEventCoordinators.execute(),
  ]);

  if (result === null) {
    forbidden();
  }

  const { event, canReassignCoordinator } = result;
  const coordinatorName =
    eventCoordinators.find((c) => c.userAccountId === event.assignedCoordinatorUserAccountId)?.name ?? null;

  return (
    <StaffShell
      role="lead"
      activeSection="coordinators"
      crumbs={detailCrumbs("lead", "queue", "Coordinators", event.name, "/staff/lead/coordinators")}
    >
      <PageHeader
        title={event.name}
        description={event.clientOrganisationName || "Event"}
        actions={<StatusBadge status={event.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The event</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldList
                fields={[
                  { label: "Date", value: event.preferredDate },
                  { label: "Coordinator", value: coordinatorName },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Reassign coordinator</CardTitle>
              <CardDescription>Hand the event to another coordinator.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReassignEventCoordinatorForm
                eventId={event.id}
                eventName={event.name}
                eventStatus={event.status}
                currentCoordinatorUserAccountId={event.assignedCoordinatorUserAccountId}
                reassignmentAllowed={canReassignCoordinator}
                eventCoordinators={eventCoordinators}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
