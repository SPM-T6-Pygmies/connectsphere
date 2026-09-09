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
import { bookingQueue } from "@/lib/wireframe";

import { EmptyState } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

export const metadata = { title: "Booking requests | ConnectSphere" };

export default function VenuePage() {
  const queue = bookingQueue();
  const pending = queue.filter(
    (entry) => entry.booking.status === "Requested",
  ).length;

  return (
    <StaffShell role="venue" crumbs={[{ label: "Booking requests" }]} defaultOpen={false}>
      <PageHeader
        title="Booking requests"
        description="Requests to decide, awaiting ones first. A venue holds at most one live booking per date and slot."
        actions={
          <Badge variant={pending > 0 ? "warning" : "success"}>
            {pending} awaiting decision
          </Badge>
        }
      />

      {queue.length === 0 ? (
        <EmptyState title="No booking requests" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Slots</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map(({ event, booking }) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <Link
                      href={`/staff/venue/${booking.id}`}
                      className="font-medium hover:underline"
                    >
                      {booking.venue.location}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      Capacity {booking.venue.capacity}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {booking.slotDate}
                  </TableCell>
                  <TableCell>
                    <span className="flex gap-1">
                      {booking.slots.map((slot) => (
                        <Badge key={slot} variant="outline">
                          {slot}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.request.expectedAttendance ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/staff/venue/${booking.id}`}>
                        {booking.status === "Requested" ? "Decide" : "View"}
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
