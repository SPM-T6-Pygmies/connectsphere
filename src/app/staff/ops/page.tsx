import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assignmentQueue, awaitingAssignment } from "@/lib/wireframe";

import { EmptyState } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

export const metadata = { title: "Assignment queue | ConnectSphere" };

export default function OpsPage() {
  const queue = assignmentQueue();
  const unassigned = awaitingAssignment();

  return (
    <StaffShell role="ops" crumbs={[{ label: "Assignment queue" }]}>
      <PageHeader
        title="Assignment queue"
        description="Every submitted request, unassigned first. Assigning a coordinator takes effect immediately — there is no acceptance step and no decline path."
        actions={
          <Badge variant={unassigned.length > 0 ? "warning" : "success"}>
            {unassigned.length} awaiting assignment
          </Badge>
        }
      />

      {queue.length === 0 ? (
        <EmptyState title="Nothing submitted" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Preferred date</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map(({ id, request }) => (
                <TableRow key={id}>
                  <TableCell>
                    <Link
                      href={`/staff/ops/${id}`}
                      className="font-medium hover:underline"
                    >
                      {request.eventName}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      Submitted {request.submittedAt ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.clientOrganisation}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.requestedBy.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.preferredDate ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.expectedAttendance ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell>
                    {request.assignedCoordinator ? (
                      <span className="text-muted-foreground text-sm">
                        {request.assignedCoordinator.name}
                      </span>
                    ) : (
                      <Badge variant="warning">Unassigned</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/staff/ops/${id}`}>
                        {request.assignedCoordinator ? "Reassign" : "Assign"}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </StaffShell>
  );
}
