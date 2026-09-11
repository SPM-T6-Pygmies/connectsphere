import { InfoIcon } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { buildViewOrganisationEventRequests } from "@/composition/container";
import type { EventRequestStatus } from "@/lib/wireframe";

import { PageHeader, StaffShell } from "../../staff-shell";
import { StatusBadge } from "../../status-badge";
import { reassignEventOrganiser } from "./actions";

/**
 * SPM-39's demo identities (`organiser-demo-seed.ts`), reduced to the
 * primitives the driving port takes. Stands in for a session until SPM-13
 * (login) exists -- see the "Viewing as" switcher below.
 */
const DEMO_ORGANISERS = {
  alice: {
    name: "Alice",
    userAccountId: "organiser-alice",
    clientOrganisationId: "sunrise-events-co",
  },
  ben: {
    name: "Ben",
    userAccountId: "organiser-ben",
    clientOrganisationId: "sunrise-events-co",
  },
  cara: {
    name: "Cara",
    userAccountId: "organiser-cara",
    clientOrganisationId: "harbour-logistics",
  },
} as const;

type DemoOrganiserKey = keyof typeof DEMO_ORGANISERS;

function isDemoOrganiserKey(value: string | undefined): value is DemoOrganiserKey {
  return value !== undefined && value in DEMO_ORGANISERS;
}

export const metadata = { title: "Organisation events | ConnectSphere" };

/**
 * SPM-115: every event request raised by anyone in the caller's client
 * organisation (AC1/AC3/AC4), with an Edit affordance only where the real
 * access predicate (`eventRequestAccessFor`) says so (AC2) -- not a fixture,
 * a call through `src/composition` to the actual tested use case.
 */
export default async function OrganisationEventsPage({
  searchParams,
}: PageProps<"/staff/requester/organisation">) {
  const { as } = await searchParams;
  const asParam = typeof as === "string" ? as : undefined;
  const key: DemoOrganiserKey = isDemoOrganiserKey(asParam) ? asParam : "alice";
  const organiser = DEMO_ORGANISERS[key];

  const viewOrganisationEventRequests = await buildViewOrganisationEventRequests();
  const { eventRequests } = await viewOrganisationEventRequests.execute({
    userAccountId: organiser.userAccountId,
    clientOrganisationId: organiser.clientOrganisationId,
  });

  /**
   * SPM-39 AC5: who the current responsible Organiser could hand a request
   * to -- colleagues in the same client organisation, not themselves.
   */
  const reassignmentTargets = (Object.keys(DEMO_ORGANISERS) as DemoOrganiserKey[]).filter(
    (candidate) =>
      candidate !== key &&
      DEMO_ORGANISERS[candidate].clientOrganisationId === organiser.clientOrganisationId,
  );

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
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground mr-1">Viewing as</span>
            {(Object.keys(DEMO_ORGANISERS) as DemoOrganiserKey[]).map((candidate) => (
              <Link
                key={candidate}
                href={`/staff/requester/organisation?as=${candidate}`}
                className={
                  candidate === key
                    ? "bg-secondary text-secondary-foreground rounded-md px-2 py-1 font-medium"
                    : "hover:bg-muted rounded-md px-2 py-1"
                }
              >
                {DEMO_ORGANISERS[candidate].name}
              </Link>
            ))}
          </div>
        }
      />

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>No login yet (SPM-13)</AlertTitle>
        <AlertDescription>
          The switcher above stands in for a signed-in Organiser&apos;s identity.
          The list itself is not a fixture: it is a real call to{" "}
          <code>ViewOrganisationEventRequestsUseCase</code>, so the Edit
          column reflects the actual access rule, not a hardcoded value.
        </AlertDescription>
      </Alert>

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
                    <TableCell>
                      <StatusBadge status={request.status as EventRequestStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      {request.canEdit ? (
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant="success">Edit</Badge>
                          {reassignmentTargets.length > 0 && (
                            <form
                              action={reassignEventOrganiser}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="eventRequestId" value={request.id} />
                              <select
                                name="newResponsibleOrganiserId"
                                className="border-input bg-background rounded-md border px-1.5 py-1 text-xs"
                                defaultValue={
                                  DEMO_ORGANISERS[reassignmentTargets[0]].userAccountId
                                }
                              >
                                {reassignmentTargets.map((candidate) => (
                                  <option
                                    key={candidate}
                                    value={DEMO_ORGANISERS[candidate].userAccountId}
                                  >
                                    {DEMO_ORGANISERS[candidate].name}
                                  </option>
                                ))}
                              </select>
                              <Button type="submit" size="sm" variant="outline">
                                Reassign
                              </Button>
                            </form>
                          )}
                        </div>
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
