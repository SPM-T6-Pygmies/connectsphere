import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { actingCoordinator, buildViewAssignedEventRequests } from "@/composition/container";
import type { AssignedEventRequestSummary } from "@/core/ports/inbound/view-assigned-event-requests";

import { EmptyState } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

export const metadata = { title: "My requests | ConnectSphere" };

function AssignedRequestTable({ requests }: { requests: readonly AssignedEventRequestSummary[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No requests awaiting review"
        description="Requests operations assigns to you will appear here."
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
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <Link href={`/staff/coordinator/${request.id}`} className="font-medium hover:underline">
                  {request.eventName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{request.clientOrganisationName}</TableCell>
              <TableCell className="text-muted-foreground">{request.preferredDate ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function CoordinatorPage() {
  const coordinator = actingCoordinator();
  const viewAssignedEventRequests = await buildViewAssignedEventRequests();
  const { eventRequests } = await viewAssignedEventRequests.execute(coordinator);

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "My requests" }]}>
      <PageHeader
        title="Requests assigned to me"
        description="Event requests an Operations Manager has assigned to you for review."
      />
      <AssignedRequestTable requests={eventRequests} />
    </StaffShell>
  );
}
