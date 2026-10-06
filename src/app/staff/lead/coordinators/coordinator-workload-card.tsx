import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CoordinatorWorkloadView } from "@/core/use-cases/view-coordinator-workloads";

import { StatusBadge } from "../../status-badge";

/** One coordinator's open requests and active events (SPM-256 AC1, AC2). */
export function CoordinatorWorkloadCard({ coordinator }: { coordinator: CoordinatorWorkloadView }) {
  const { requests, events } = coordinator;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{coordinator.name}</CardTitle>
        <CardDescription>
          {requests.length} open {requests.length === 1 ? "request" : "requests"} ·{" "}
          {events.length} active {events.length === 1 ? "event" : "events"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 && events.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing assigned</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work</TableHead>
                <TableHead>Client organisation</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={`request-${request.id}`}>
                  <TableCell className="font-medium">
                    <Link href={`/staff/lead/${request.id}`} className="hover:underline">
                      {request.eventName}
                    </Link>
                    <span className="text-muted-foreground"> · request</span>
                  </TableCell>
                  <TableCell>{request.clientOrganisationName}</TableCell>
                  <TableCell>{request.preferredDate ?? "No date yet"}</TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                </TableRow>
              ))}
              {events.map((event) => (
                <TableRow key={`event-${event.id}`}>
                  <TableCell className="font-medium">
                    {event.name}
                    <span className="text-muted-foreground"> · event</span>
                  </TableCell>
                  <TableCell>{event.clientOrganisationName}</TableCell>
                  <TableCell>{event.preferredDate ?? "No date yet"}</TableCell>
                  <TableCell>
                    <StatusBadge status={event.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
