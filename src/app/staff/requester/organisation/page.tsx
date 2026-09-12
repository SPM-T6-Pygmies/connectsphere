import Link from "next/link";

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
import {
  buildListOrganisationOrganisers,
  buildViewOrganisationEventRequests,
  getCurrentOrganiser,
} from "@/composition/container";
import type { EventRequestStatus } from "@/lib/wireframe";

import { PageHeader, StaffShell } from "../../staff-shell";
import { StatusBadge } from "../../status-badge";
import { reassignEventOrganiserAction } from "./actions";

/**
 * SPM-39's demo identities (`organiser-demo-seed.ts`), reduced to the
 * primitives the driving port takes. Used only when there is no real signed-
 * in Organiser (see `getCurrentOrganiser`) -- e.g. testing before SPM-13's
 * login existed, or reaching this page in some other role.
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
 *
 * The caller's identity is the real signed-in Organiser when one exists
 * (`getCurrentOrganiser`, SPM-13), falling back to the demo switcher only
 * when it doesn't -- e.g. no session, or the session isn't an Organiser's.
 */
export default async function OrganisationEventsPage({
  searchParams,
}: PageProps<"/staff/requester/organisation">) {
  const session = await getCurrentOrganiser();

  const { as } = await searchParams;
  const asParam = typeof as === "string" ? as : undefined;
  const key: DemoOrganiserKey = isDemoOrganiserKey(asParam) ? asParam : "alice";
  const demoOrganiser = DEMO_ORGANISERS[key];

  const organiser = session ?? demoOrganiser;

  /** Reassignment candidates: Organisers in the same client organisation, demo or real. */
  const listOrganisationOrganisers = await buildListOrganisationOrganisers();
  const { organisers: colleagues } = await listOrganisationOrganisers.execute({
    clientOrganisationId: organiser.clientOrganisationId,
  });

  const viewOrganisationEventRequests = await buildViewOrganisationEventRequests();
  const { eventRequests } = await viewOrganisationEventRequests.execute({
    userAccountId: organiser.userAccountId,
    clientOrganisationId: organiser.clientOrganisationId,
  });

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
          session ? (
            <span className="text-muted-foreground text-sm">
              Logged in as <span className="text-foreground font-medium">{session.name}</span>
            </span>
          ) : (
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
          )
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Access</TableHead>
                  <TableHead>Reassign to</TableHead>
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
                        <Badge variant="success">Edit</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          View only
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {colleagues.length === 0 ? (
                        <span className="text-muted-foreground text-xs">
                          No colleagues to reassign to yet
                        </span>
                      ) : (
                        <form action={reassignEventOrganiserAction} className="flex gap-2">
                          <input type="hidden" name="eventRequestId" value={request.id} />
                          <select
                            name="newResponsibleOrganiserId"
                            defaultValue=""
                            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-40 rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3"
                          >
                            <option value="" disabled>
                              Choose organiser…
                            </option>
                            {colleagues.map((colleague) => (
                              <option key={colleague.userAccountId} value={colleague.userAccountId}>
                                {colleague.name}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" variant="outline" size="sm">
                            Reassign
                          </Button>
                        </form>
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
