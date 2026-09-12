import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { actingCoordinator, buildViewAssignedEvents } from "@/composition/container";
import type { AssignedEventSummary } from "@/core/ports/inbound/view-assigned-events";

import { EmptyState } from "../../field-list";
import { PageHeader, StaffShell } from "../../staff-shell";
import { StatusBadge } from "../../status-badge";

export const metadata = { title: "My events | ConnectSphere" };

function AssignedEventTable({ events }: { events: readonly AssignedEventSummary[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No events yet"
        description="Approved requests you are planning will appear here."
      />
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Client organisation</TableHead>
            <TableHead>Preferred date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <Link href={`/staff/coordinator/${event.id}`} className="font-medium hover:underline">
                  {event.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{event.clientOrganisationName}</TableCell>
              <TableCell className="text-muted-foreground">{event.preferredDate ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={event.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function CoordinatorEventsPage() {
  const coordinator = actingCoordinator();
  const viewAssignedEvents = await buildViewAssignedEvents();
  const { events } = await viewAssignedEvents.execute(coordinator);

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "My events" }]} coordinatorSection="events">
      <PageHeader
        title="My events"
        description="Approved requests you are planning, from submission through completion."
      />
      <AssignedEventTable events={events} />
    </StaffShell>
  );
}
