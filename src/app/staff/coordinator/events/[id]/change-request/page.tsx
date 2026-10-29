import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildViewEventChangeRequests, getCurrentCoordinator } from "@/composition/container";

import { PageHeader, StaffShell } from "../../../../staff-shell";
import { ChangeValue } from "./change-value";
import { CHANGE_REQUEST_FIELD_LABELS } from "./field-labels";
import { DecideChangeRequestForm } from "./decide-change-request-form";

export const metadata = { title: "Change requests | ConnectSphere" };

const SUBMITTED = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeZone: "Asia/Singapore" });

/**
 * SPM-100: the event's assigned Coordinator decides its open change request
 * field by field, and sees the requests already decided.
 */
export default async function Page({ params }: PageProps<"/staff/coordinator/events/[id]/change-request">) {
  const { id } = await params;

  // An event that is not theirs, or does not exist, gets the same access-denied
  // screen (#91), so a guess cannot confirm an event exists.
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    forbidden();
  }

  const viewEventChangeRequests = await buildViewEventChangeRequests();
  const view = await viewEventChangeRequests.execute({ eventId: id, ...coordinator });
  if (view === null) {
    forbidden();
  }

  return (
    <StaffShell
      role="coordinator"
      crumbs={[
        { label: "My events", href: "/staff/coordinator/events" },
        { label: view.eventName, href: `/staff/coordinator/events/${id}` },
        { label: "Change requests" },
      ]}
      coordinatorSection="events"
    >
      <PageHeader
        title="Change requests"
        description="Accept or decline each change. Accepted changes are applied to the event; a decline needs a reason."
      />

      {view.open === null ? (
        <p className="text-muted-foreground text-sm">No change request is waiting on you.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Waiting on you</CardTitle>
            <CardDescription>Submitted {SUBMITTED.format(view.open.submittedAt)}</CardDescription>
          </CardHeader>
          <CardContent>
            <DecideChangeRequestForm eventId={id} request={view.open} current={view.current} />
          </CardContent>
        </Card>
      )}

      {view.decided.map((request) => (
        <Card key={request.id}>
          <CardHeader>
            <CardTitle>Decided</CardTitle>
            <CardDescription>Submitted {SUBMITTED.format(request.submittedAt)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {request.items.map((item) => (
                <li key={item.change.field} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{CHANGE_REQUEST_FIELD_LABELS[item.change.field]}</span>
                    <Badge variant={item.decision === "Accepted" ? "default" : "secondary"}>{item.decision}</Badge>
                  </div>
                  <div>
                    <ChangeValue change={item.change} />
                  </div>
                  {item.reason !== null && <p className="text-muted-foreground">Reason: {item.reason}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </StaffShell>
  );
}
