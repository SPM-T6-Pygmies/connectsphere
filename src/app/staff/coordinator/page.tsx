import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTING_AS,
  blockingArrangements,
  coordinatorEvents,
  registrationUnlocked,
} from "@/lib/wireframe";

import { EmptyState } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

export const metadata = { title: "My events | ConnectSphere" };

export default function CoordinatorPage() {
  const events = coordinatorEvents();

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "My events" }]}>
      <PageHeader
        title="My events"
        description={`Events assigned to ${ACTING_AS.coordinator.name}, with what is blocking each one from being confirmed.`}
      />

      {events.length === 0 ? (
        <EmptyState title="No events assigned" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Event status</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Blocking confirmation</TableHead>
                <TableHead className="text-right">Registration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const blocking = blockingArrangements(event);

                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Link
                        href={`/staff/coordinator/${event.id}`}
                        className="font-medium hover:underline"
                      >
                        {event.name}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {event.request.clientOrganisation} ·{" "}
                        {event.request.requestedBy.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.request.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.request.preferredDate ?? "—"}
                    </TableCell>
                    <TableCell>
                      {blocking.length === 0 ? (
                        <span className="text-muted-foreground text-sm">
                          Nothing outstanding
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center gap-1.5 text-sm">
                          <AlertTriangleIcon className="size-3.5 shrink-0" />
                          {blocking.map((row) => row.label).join(", ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {registrationUnlocked(event) ? (
                        <Badge variant={event.registrationEnabled ? "success" : "outline"}>
                          {event.registrationEnabled ? "Open" : "Not enabled"}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Locked</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </StaffShell>
  );
}
