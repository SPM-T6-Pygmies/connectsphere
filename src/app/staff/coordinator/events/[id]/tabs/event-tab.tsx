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
import type { ViewCoordinatorEventResult } from "@/core/use-cases/view-coordinator-event";

import { ARRANGEMENT_LABELS } from "../arrangement-labels";

/** SPM-285: the event itself -- what it is, when, how many -- and its essential arrangements. */
export function EventDetailsTab({ event, readiness }: Pick<ViewCoordinatorEventResult, "event" | "readiness">) {
  return (
    <>
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
