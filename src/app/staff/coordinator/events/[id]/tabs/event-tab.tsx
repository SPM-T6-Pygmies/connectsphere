import { LockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { eventDetailsEditable, ORDINARY_EVENT_FIELDS, type OrdinaryEventDetails } from "@/core/domain/event-details-edit";
import type { ViewCoordinatorEventResult } from "@/core/use-cases/view-coordinator-event";

import { ARRANGEMENT_LABELS } from "../arrangement-labels";
import { EventDetailsCard } from "./event-details-card";

/**
 * SPM-285: the event itself -- what it is, when, how many -- and its essential arrangements.
 *
 * SPM-49: the ordinary details are edited here; when and how many are shown
 * locked, because they change only through a change request (#4).
 */
export function EventDetailsTab({
  event,
  details,
  readiness,
}: Pick<ViewCoordinatorEventResult, "event" | "details" | "readiness">) {
  const ordinary = Object.fromEntries(
    ORDINARY_EVENT_FIELDS.map((field) => [field, details[field]]),
  ) as OrdinaryEventDetails;
  const slots = details.slots.map(({ date, slot }) => `${date} ${slot}`).join(", ");

  return (
    <>
      <EventDetailsCard eventId={event.id} details={ordinary} editable={eventDetailsEditable(event.status)} />

      <Card>
        <CardHeader>
          <CardTitle>When and how many</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <LockIcon className="size-3.5" aria-hidden />
            Date, timeslots, attendance, venue and equipment changes go through a change request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs">Preferred date</dt>
              <dd>{event.preferredDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Timeslots</dt>
              <dd>{slots || "—"}</dd>
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
                  <TableHead>Detail</TableHead>
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
                    <TableCell className="text-muted-foreground text-xs">
                      {arrangement.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
