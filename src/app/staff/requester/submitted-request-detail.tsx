import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { EventTimes } from "@/app/events/event-times";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChangeRequestState } from "@/core/domain/change-request";
import { preferredTimeRange } from "@/core/domain/event-request";
import type { TimeRangeOnDate } from "@/core/domain/event-times";
import type { OrganiserEventArrangements } from "@/core/ports/outbound/event-request-repository";
import type {
  ClarificationMessageView,
  EventRequestView,
} from "@/core/use-cases/event-request-view";

import { ClarificationThread } from "../clarification-thread";
import { FieldList } from "../field-list";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";
import { ClarificationComposer } from "./[id]/clarification-composer";

/** `h:mm am/pm`, in the viewer's own timezone -- for an instant, not a calendar date. */
/**
 * How far along the request has travelled.
 *
 * Arrangement confirmation has no adapter yet (SPM-73), so that step reads
 * as not-yet-started rather than inventing a booking the store does not have.
 */
function timeline(request: EventRequestView, coordinatorName: string | null) {
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
      detail: request.submittedAt?.slice(0, 10) ?? "Not submitted",
    },
    {
      label: "Coordinator assigned",
      done: coordinatorName !== null,
      detail: coordinatorName ?? "Awaiting assignment",
    },
    { label: "Under review", done: reviewed, detail: reviewed ? "Reviewed by your coordinator" : "Not started" },
    {
      label: "Approved to plan",
      done: approved,
      detail: approved ? "Planning can proceed" : "Not yet approved",
    },
    { label: "Arrangements confirmed", done: false, detail: "In progress" },
  ];
}

/**
 * SPM-31: the Organiser's own view of a request they have submitted, and
 * SPM-33's clarification exchange alongside it.
 *
 * The exchange adds a reply box and nothing else. No field became editable --
 * a submitted request is still locked (#102), and answering a question about
 * it was never an edit, which is exactly why the exchange is an append. There
 * is no Resolve control either: marking a clarification resolved is the
 * Coordinator's alone (AC7).
 */
export function SubmittedRequestDetail({
  eventRequest,
  clarificationThread,
  organiserName,
  canDiscuss,
  assignedCoordinatorName,
  eventTimes,
  eventArrangements,
  changeRequest,
  origin = "queue",
}: {
  eventRequest: EventRequestView;
  /** The clarification exchange so far (SPM-33 AC4) -- the same record the Coordinator reads. */
  clarificationThread: readonly ClarificationMessageView[];
  /** Whoever is signed in, for the composer's avatar. */
  organiserName: string;
  /** Whether the thread still takes messages, from the use case. */
  canDiscuss: boolean;
  /** Null until Operations assigns a coordinator. */
  assignedCoordinatorName: string | null;
  /** SPM-326 AC6: when the event runs, once the request is approved; null before. */
  eventTimes: readonly TimeRangeOnDate[] | null;
  /** SPM-66 AC3: the event's status and what has been arranged for it, once the request is approved; null before. */
  eventArrangements: OrganiserEventArrangements | null;
  /** SPM-52: whether the signed-in Organiser may ask for a change to the event now. */
  changeRequest: ChangeRequestState;
  origin?: DetailOrigin;
}) {
  const { details } = eventRequest;

  const preferredTime = preferredTimeRange(details);

  return (
    <StaffShell
      role="requester"
      crumbs={detailCrumbs("requester", origin, "My requests", details.eventName)}
    >
      <PageHeader
        title={details.eventName}
        description={`Submitted ${eventRequest.submittedAt?.slice(0, 10) ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            {changeRequest === "available" && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/staff/requester/${eventRequest.id}/change-request`}>Request a change</Link>
              </Button>
            )}
            {changeRequest === "open" && <Badge variant="secondary">Change request pending</Badge>}
            <StatusBadge status={eventRequest.status} />
          </div>
        }
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
                  {
                    label: "Preferred time",
                    value: preferredTime === null ? null : <EventTimes times={[preferredTime]} />,
                  },
                  ...(eventTimes === null
                    ? []
                    : [{ label: "Event times", value: <EventTimes times={eventTimes} nameEveryDay /> }]),
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

          {eventArrangements === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle>Your event</CardTitle>
                <CardDescription>
                  What your coordinator has arranged. Once Confirmed,
                  ConnectSphere is committed to these arrangements.
                </CardDescription>
                <div>
                  <StatusBadge status={eventArrangements.status} />
                </div>
              </CardHeader>
              <CardContent>
                <FieldList
                  fields={[
                    {
                      label: "Venue",
                      value:
                        eventArrangements.venues.length === 0
                          ? "None confirmed yet"
                          : eventArrangements.venues.join(", "),
                    },
                    {
                      label: "Equipment reserved",
                      value:
                        eventArrangements.equipment.length === 0
                          ? "None reserved"
                          : eventArrangements.equipment
                              .map((line) => `${line.quantityReserved} × ${line.equipmentType}`)
                              .join(", "),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          <ClarificationThread
            messages={clarificationThread}
            actingAsName={organiserName}
            closed={!canDiscuss}
            description="Questions your coordinator has asked about this request, and your answers. Kept with the request."
            emptyMessage="Your coordinator has not asked anything yet."
            composer={<ClarificationComposer eventRequestId={eventRequest.id} />}
            replyComposer={(parentId) => (
              <ClarificationComposer eventRequestId={eventRequest.id} parentId={parentId} />
            )}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {timeline(eventRequest, assignedCoordinatorName).map((entry) => (
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
