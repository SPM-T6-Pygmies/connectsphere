import { FilePlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACTING_AS,
  draftRequests,
  requestsForOrganiser,
  submittedRequests,
  type EventRecord,
} from "@/lib/wireframe";

import { EmptyState } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

export const metadata = { title: "My requests | ConnectSphere" };

function RequestTable({
  events,
  emptyTitle,
  emptyDescription,
}: {
  events: readonly EventRecord[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (events.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Preferred date</TableHead>
            <TableHead>Coordinator</TableHead>
            <TableHead className="text-right">Last updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <Link
                  href={
                    event.request.status === "Draft"
                      ? `/staff/requester/new?draft=${event.id}`
                      : `/staff/requester/${event.id}`
                  }
                  className="font-medium hover:underline"
                >
                  {event.request.eventName}
                </Link>
                <div className="text-muted-foreground text-xs">
                  {event.request.categoryType ?? "No category yet"}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={event.request.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {event.request.preferredDate ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {event.request.assignedCoordinator?.name ?? "Not yet assigned"}
              </TableCell>
              <TableCell className="text-muted-foreground text-right">
                {event.request.updatedAt}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function RequesterPage() {
  const all = requestsForOrganiser();
  const drafts = draftRequests();
  const submitted = submittedRequests();

  return (
    <StaffShell role="requester" crumbs={[{ label: "My requests" }]} defaultOpen={false}>
      <PageHeader
        title="My event requests"
        description={`Requests raised by ${ACTING_AS.requester.name}. A draft can be edited until it is submitted; after that, changes route through the assigned coordinator.`}
        actions={
          <Button asChild>
            <Link href="/staff/requester/new">
              <FilePlusIcon />
              New request
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
          <TabsTrigger value="submitted">
            Submitted ({submitted.length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts">
          <RequestTable
            events={drafts}
            emptyTitle="No drafts"
            emptyDescription="Requests you save before submitting will appear here."
          />
        </TabsContent>
        <TabsContent value="submitted">
          <RequestTable
            events={submitted}
            emptyTitle="Nothing submitted yet"
            emptyDescription="Submit a draft and it moves here."
          />
        </TabsContent>
        <TabsContent value="all">
          <RequestTable events={all} emptyTitle="No requests" />
        </TabsContent>
      </Tabs>
    </StaffShell>
  );
}
