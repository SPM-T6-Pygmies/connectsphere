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
import { actingOrganiser, buildViewMyEventRequests } from "@/composition/container";
import type { MyEventRequestSummary } from "@/core/ports/inbound/view-my-event-requests";

import { EmptyState } from "../field-list";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

export const metadata = { title: "My requests | ConnectSphere" };

function RequestTable({
  requests,
  emptyTitle,
  emptyDescription,
}: {
  requests: readonly MyEventRequestSummary[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (requests.length === 0) {
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
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <Link
                  href={
                    request.status === "Draft"
                      ? `/staff/requester/new?draft=${request.id}`
                      : `/staff/requester/${request.id}`
                  }
                  className="font-medium hover:underline"
                >
                  {request.eventName}
                </Link>
                <div className="text-muted-foreground text-xs">No category yet</div>
              </TableCell>
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {request.preferredDate ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">Not yet assigned</TableCell>
              <TableCell className="text-muted-foreground text-right">
                {request.submittedAt?.toISOString().slice(0, 10) ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function RequesterPage() {
  const organiser = actingOrganiser();
  const viewMyEventRequests = await buildViewMyEventRequests();
  const { eventRequests } = await viewMyEventRequests.execute(organiser);

  const drafts = eventRequests.filter((request) => request.status === "Draft");
  const submitted = eventRequests.filter((request) => request.status !== "Draft");

  return (
    <StaffShell role="requester" crumbs={[{ label: "My requests" }]} defaultOpen={false}>
      <PageHeader
        title="My event requests"
        description="A draft can be edited until it is submitted; after that, changes route through the assigned coordinator."
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
          <TabsTrigger value="all">All ({eventRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts">
          <RequestTable
            requests={drafts}
            emptyTitle="No drafts"
            emptyDescription="Requests you save before submitting will appear here."
          />
        </TabsContent>
        <TabsContent value="submitted">
          <RequestTable
            requests={submitted}
            emptyTitle="Nothing submitted yet"
            emptyDescription="Submit a draft and it moves here."
          />
        </TabsContent>
        <TabsContent value="all">
          <RequestTable requests={eventRequests} emptyTitle="No requests" />
        </TabsContent>
      </Tabs>
    </StaffShell>
  );
}
