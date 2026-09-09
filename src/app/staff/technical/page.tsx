import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { EQUIPMENT_CATALOGUE, technicalQueue } from "@/lib/wireframe";

import { EmptyState } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

export const metadata = { title: "Equipment reviews | ConnectSphere" };

export default function TechnicalPage() {
  const queue = technicalQueue();
  const pending = queue.filter(
    (entry) => entry.reservation.status === "Requested",
  ).length;

  return (
    <StaffShell role="technical" crumbs={[{ label: "Equipment reviews" }]} defaultOpen={false}>
      <PageHeader
        title="Equipment reviews"
        description="Reservations to work through, unreviewed first. There is no approval workflow — the coordinator records what is needed, you reserve what exists."
        actions={
          <Badge variant={pending > 0 ? "warning" : "success"}>
            {pending} awaiting review
          </Badge>
        }
      />

      {queue.length === 0 ? (
        <EmptyState title="No equipment requests" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Support</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map(({ event, reservation }) => {
                const shortfall = reservation.lines.filter(
                  (line) => line.quantityReserved < line.quantityRequested,
                ).length;

                return (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <Link
                        href={`/staff/technical/${reservation.id}`}
                        className="font-medium hover:underline"
                      >
                        {event.name}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {event.request.clientOrganisation}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.request.preferredDate ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {reservation.lines.length}
                      </span>
                      {shortfall > 0 ? (
                        <span className="text-destructive ml-2 text-xs">
                          {shortfall} short
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {event.support?.supportNeeded ? (
                        <Badge
                          variant={
                            event.support.assignedStaff.length > 0
                              ? "success"
                              : "warning"
                          }
                        >
                          {event.support.assignedStaff.length > 0
                            ? "Assigned"
                            : "Unassigned"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Not needed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={reservation.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/staff/technical/${reservation.id}`}>
                          {reservation.status === "Requested"
                            ? "Review"
                            : "View"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Equipment catalogue</CardTitle>
          <CardDescription>
            Pooled counts, not individual units. Items can be collected the day
            before and come back into the pool the day after return.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>In pool</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EQUIPMENT_CATALOGUE.map((item) => (
                <TableRow key={item.type}>
                  <TableCell className="font-medium">{item.type}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.location}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </StaffShell>
  );
}
