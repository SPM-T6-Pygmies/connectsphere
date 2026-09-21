import { CheckIcon, AlertTriangleIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildViewCoordinatorEvent, getCurrentCoordinator } from "@/composition/container";
import type { ArrangementType } from "@/core/domain/event-readiness";

import { detailCrumbs } from "../../../detail-origin";
import { PageHeader, StaffShell } from "../../../staff-shell";
import { StatusBadge } from "../../../status-badge";
import { ConfirmForm } from "./confirm-form";

export const metadata = { title: "Event | ConnectSphere" };

/** Display labels only -- the domain names arrangement types, not their prose. */
const ARRANGEMENT_LABELS: Record<ArrangementType, string> = {
  venue: "Venue",
  equipment: "Equipment",
  technical_support: "Technical support",
  programme: "Programme",
  registration: "Registration",
  other: "Other",
};

/**
 * SPM-50: one event, its essential-arrangement readiness, and the Confirm
 * gate -- a minimal page, not the tabbed workspace the old wireframe
 * envisioned (SPM-137 was cancelled before that got built). Only venue,
 * programme and registration are evaluated for completeness (SPM-144 tracks
 * deciding essentiality for the rest).
 */
export default async function CoordinatorEventPage({
  params,
}: PageProps<"/staff/coordinator/events/[id]">) {
  const { id } = await params;

  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    notFound();
  }

  const viewCoordinatorEvent = await buildViewCoordinatorEvent();
  const result = await viewCoordinatorEvent.execute({ id, ...coordinator });
  if (result === null) {
    notFound();
  }

  const { event, clientOrganisationName, owningOrganiserName, readiness, canConfirm, blockingArrangements } =
    result;
  const alreadyConfirmed = event.status === "Confirmed" || event.status === "Completed";

  return (
    <StaffShell
      role="coordinator"
      crumbs={detailCrumbs("coordinator", "queue", "My events", event.name, "/staff/coordinator/events")}
      coordinatorSection="events"
    >
      <PageHeader
        title={event.name}
        description={`${clientOrganisationName} · requested by ${owningOrganiserName}`}
        actions={<StatusBadge status={event.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {event.description ? (
                <p className="text-sm">{event.description}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No description was given.</p>
              )}
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs">Preferred date</dt>
                  <dd>{event.preferredDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Expected attendance</dt>
                  <dd>{event.expectedAttendance ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Essential arrangements</CardTitle>
              <CardDescription>
                Only venue, programme and registration are checked automatically today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readiness.essentialArrangements.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No essential arrangements are recorded for this event.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arrangement</TableHead>
                      <TableHead>Complete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readiness.essentialArrangements.map((arrangement) => (
                      <TableRow key={arrangement.type}>
                        <TableCell className="font-medium">
                          {ARRANGEMENT_LABELS[arrangement.type]}
                        </TableCell>
                        <TableCell>
                          {arrangement.complete ? (
                            <Badge variant="success">Done</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Outstanding</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Confirmation</CardTitle>
              <CardDescription>
                Confirming commits ConnectSphere to the arrangements and makes them visible to the organiser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {alreadyConfirmed ? (
                <Alert>
                  <CheckIcon />
                  <AlertTitle>Already {event.status.toLowerCase()}</AlertTitle>
                </Alert>
              ) : blockingArrangements.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>
                    Cannot confirm -- {blockingArrangements.length} essential arrangement
                    {blockingArrangements.length === 1 ? "" : "s"} incomplete
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {blockingArrangements.map((type) => (
                        <li key={type}>{ARRANGEMENT_LABELS[type]}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckIcon />
                  <AlertTitle>Ready to confirm</AlertTitle>
                </Alert>
              )}

              {alreadyConfirmed ? null : <ConfirmForm eventId={event.id} canConfirm={canConfirm} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
