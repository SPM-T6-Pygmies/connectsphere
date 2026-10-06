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
import type { EventAwaitingSafetyCheck } from "@/core/use-cases/list-events-awaiting-safety-check";

/**
 * SPM-259: the events whose venue and equipment are confirmed, waiting for a
 * safety check. Each opens its review page, where the outcome is recorded (SPM-260).
 */
export function EventsAwaitingCheckCard({ events }: { events: readonly EventAwaitingSafetyCheck[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Awaiting check</CardTitle>
        <CardDescription>
          Events whose venue bookings are all confirmed and whose equipment is fully reserved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No events awaiting a safety check</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Expected attendance</TableHead>
                <TableHead>Venues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell className="font-medium">
                    <Link href={`/staff/safety/${event.eventId}`} className="underline-offset-4 hover:underline">
                      {event.eventName}
                    </Link>
                  </TableCell>
                  <TableCell>{event.preferredDate ?? "No date yet"}</TableCell>
                  <TableCell>{event.expectedAttendance ?? "Not given"}</TableCell>
                  <TableCell>{event.venues.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
