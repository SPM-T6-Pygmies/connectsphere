import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildViewArchivedEventRequests, getCurrentCoordinator } from "@/composition/container";
import type { AssignedEventRequestSummary } from "@/core/use-cases/view-assigned-event-requests";

import { EmptyState } from "../../field-list";
import { PageHeader, StaffShell } from "../../staff-shell";
import { RequestStateBadge } from "../request-state-badge";

export const metadata = { title: "Archive | ConnectSphere" };

function ArchivedRequestTable({ requests }: { requests: readonly AssignedEventRequestSummary[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="Nothing archived"
        description="Requests you reject, or that are withdrawn, will appear here."
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
                <RequestStateBadge state={request.state} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function CoordinatorArchivePage() {
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    notFound();
  }

  const viewArchivedEventRequests = await buildViewArchivedEventRequests();
  const { eventRequests } = await viewArchivedEventRequests.execute(coordinator);

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "Archive" }]} coordinatorSection="archive">
      <PageHeader
        title="Archive"
        description="Requests assigned to you that were rejected or withdrawn."
      />
      {/* Below md the queue renders as the page body; see MobileQueue. */}
      <div className="hidden md:block">
        <ArchivedRequestTable requests={eventRequests} />
      </div>
    </StaffShell>
  );
}
