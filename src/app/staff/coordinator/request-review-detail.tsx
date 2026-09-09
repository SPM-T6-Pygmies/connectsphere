import { notFound } from "next/navigation";

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
import { eventById } from "@/lib/wireframe";

import { ActivityPanel } from "../activity-panel";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { FieldList } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

/**
 * A pending request is judged purely on what was submitted -- not the full
 * tabbed event shell, which only makes sense once planning has actually
 * started. `readOnly` covers the resolved-without-approval case (Rejected,
 * Returned, Withdrawn): same fields, but the decision is already made.
 */
export function RequestReviewDetail({
  id,
  origin = "queue",
  readOnly = false,
}: {
  id: string;
  origin?: DetailOrigin;
  readOnly?: boolean;
}) {
  const event = eventById(id);

  if (!event) {
    notFound();
  }

  const request = event.request;
  const { queueLabel, queueHref } = readOnly
    ? { queueLabel: "Archive", queueHref: "/staff/coordinator/archive" }
    : { queueLabel: "My requests", queueHref: "/staff/coordinator" };

  return (
    <StaffShell
      role="coordinator"
      crumbs={detailCrumbs("coordinator", origin, queueLabel, event.name, queueHref)}
    >
      <PageHeader
        title={request.eventName}
        description={`${request.clientOrganisation} · requested by ${request.requestedBy.name} · ${request.preferredDate ?? "no date set"}`}
        actions={<StatusBadge status={request.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The request as submitted</CardTitle>
              <CardDescription>
                Everything the organiser supplied. This is what the decision
                is judged against — not a venue, equipment or staff
                commitment.
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
                  { label: "Venue requirements", value: request.venueRequirements },
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

          <ActivityPanel eventId={event.id} section="overview" />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
              {!readOnly ? (
                <CardDescription>
                  Approving says the request holds enough information to plan
                  against. It commits no venue, equipment or staff.
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {readOnly ? (
                request.decisionRecord ? (
                  <p className="text-sm leading-relaxed">
                    {request.decisionRecord}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    No decision record.
                  </p>
                )
              ) : (
                <>
                  {request.decisionRecord ? (
                    <p className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed">
                      {request.decisionRecord}
                    </p>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="decisionNote">Decision record</Label>
                    <Textarea
                      id="decisionNote"
                      placeholder="Why this was approved, returned or rejected."
                      defaultValue={request.decisionRecord ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button>Approve — planning may proceed</Button>
                    <Button variant="outline">Return for amendment</Button>
                    <Button variant="destructive">Reject</Button>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Whether a rejected request can be resubmitted is an open
                    question the customer left to the team.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldList
                columns={1}
                fields={[
                  { label: "Client", value: request.clientOrganisation },
                  { label: "Organiser", value: request.requestedBy.name },
                  { label: "Coordinator", value: event.coordinator?.name },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
