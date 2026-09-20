import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
import {
  buildListOrganisationOrganisers,
  buildViewOrganisationEventRequests,
  getCurrentOrganiser,
} from "@/composition/container";

import { PageHeader, StaffShell } from "../../staff-shell";
import { StatusBadge } from "../../status-badge";

export const metadata = { title: "Organisation events | ConnectSphere" };

/**
 * SPM-115: every event request raised by anyone in the caller's client
 * organisation (AC1/AC3/AC4), with an Edit affordance only where the real
 * access predicate (`eventRequestAccessFor`) says so (AC2) -- not a fixture,
 * a call through `src/composition` to the actual tested use case.
 *
 * The caller is the signed-in Organiser (`getCurrentOrganiser`, SPM-13);
 * anyone else gets a not-found, as on the other requester pages.
 */
export default async function OrganisationEventsPage() {
  const organiser = await getCurrentOrganiser();
  if (organiser === null) {
    notFound();
  }

  /**
   * Organisers in the same client organisation -- used only to resolve
   * "Submitted by" names below. Not for reassignment: #101 names the Event
   * Operations Manager as the only role with assign/reassign authority, not
   * the Event Organiser, so this page offers no way to trigger it.
   */
  const listOrganisationOrganisers = await buildListOrganisationOrganisers();
  const { organisers: colleagues } = await listOrganisationOrganisers.execute({
    clientOrganisationId: organiser.clientOrganisationId,
  });

  const viewOrganisationEventRequests = await buildViewOrganisationEventRequests();
  const { eventRequests } = await viewOrganisationEventRequests.execute({
    userAccountId: organiser.userAccountId,
    clientOrganisationId: organiser.clientOrganisationId,
  });

  /** Resolves each request's responsible Organiser to a name, reusing the colleague list already fetched above. */
  const organiserNames = new Map(colleagues.map((c) => [c.userAccountId, c.name]));

  return (
    <StaffShell
      role="requester"
      crumbs={[{ label: "Organisation events" }]}
      defaultOpen={false}
    >
      <PageHeader
        title="Organisation events"
        description="Every event request raised by anyone in your client organisation -- not just your own -- so nobody duplicates a request or loses context."
        actions={
          <span className="text-muted-foreground text-sm">
            Logged in as <span className="text-foreground font-medium">{organiser.name}</span>
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{organiser.clientOrganisationId}</CardTitle>
          <CardDescription>
            Automatic and organisation-wide -- every colleague sees the same
            list, and nobody administers who gets to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No event requests in this organisation yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.eventName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {organiserNames.get(request.responsibleOrganiserId) ?? request.responsibleOrganiserId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {request.canEdit ? (
                        <Badge variant="success">Edit</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          View only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </StaffShell>
  );
}
