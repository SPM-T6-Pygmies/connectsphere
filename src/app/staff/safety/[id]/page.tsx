import { forbidden, notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildViewSafetyCheck, getCurrentSafetyOfficer } from "@/composition/container";
import { EventNotFoundError } from "@/core/domain/errors";
import type { SafetyCheckView } from "@/core/use-cases/view-safety-check";

import { FieldList } from "../../field-list";
import { PageHeader, StaffShell } from "../../staff-shell";
import { SafetyCheckForm } from "./safety-check-form";

export const metadata = { title: "Safety check | ConnectSphere" };

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Muted({ children }: { children: string }) {
  return <span className="text-muted-foreground italic">{children}</span>;
}

/**
 * SPM-260: one event as the Safety Officer reviews it -- what the customer
 * listed (AC1), the outcomes already recorded (AC5) and, while it awaits a
 * check, the form to record one (AC2-AC4, AC6).
 */
export default async function SafetyCheckPage({ params }: PageProps<"/staff/safety/[id]">) {
  const { id } = await params;

  // Anyone who is not a Safety Officer gets the shared access-denied screen (AC7).
  const safetyOfficer = await getCurrentSafetyOfficer();
  if (safetyOfficer === null) {
    forbidden();
  }

  const viewSafetyCheck = await buildViewSafetyCheck();
  let check: SafetyCheckView;
  try {
    check = await viewSafetyCheck.execute({ userAccountId: safetyOfficer.userAccountId, eventId: id });
  } catch (error) {
    if (error instanceof EventNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <StaffShell
      role="safety"
      crumbs={[{ label: "Awaiting check", href: "/staff/safety" }, { label: check.eventName }]}
    >
      <PageHeader
        title={check.eventName}
        description={check.awaitsCheck ? "Awaiting a safety check" : "Not awaiting a safety check"}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Event</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldList
                fields={[
                  { label: "Date", value: check.preferredDate ?? <Muted>No date yet</Muted> },
                  { label: "Expected attendance", value: check.expectedAttendance ?? <Muted>Not given</Muted> },
                  {
                    label: "Accessibility requirements",
                    value: check.accessibilityRequirements ?? <Muted>None given</Muted>,
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Venues</CardTitle>
              <CardDescription>Each confirmed booking, with its chosen layout&apos;s capacity.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue</TableHead>
                    <TableHead>Layout</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Venue accessibility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {check.venues.map((venue, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{venue.venueName}</TableCell>
                      <TableCell>{venue.layoutName ?? <Muted>Layout not set</Muted>}</TableCell>
                      <TableCell>{venue.layoutCapacity ?? <Muted>Capacity not set</Muted>}</TableCell>
                      <TableCell className="whitespace-normal">
                        {venue.accessibility ?? <Muted>None recorded</Muted>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              {check.equipment.length === 0 ? (
                <p className="text-muted-foreground text-sm">No equipment requested</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Reserved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {check.equipment.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{line.item}</TableCell>
                        <TableCell>{line.quantityRequested}</TableCell>
                        <TableCell>{line.quantityReserved}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {check.awaitsCheck ? (
            <Card>
              <CardHeader>
                <CardTitle>Record the outcome</CardTitle>
                <CardDescription>
                  Rejecting sends your comments back as the changes needed. It does not cancel the event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SafetyCheckForm eventId={check.eventId} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Safety checks</CardTitle>
            </CardHeader>
            <CardContent>
              {check.checks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No safety check recorded yet</p>
              ) : (
                <ol className="space-y-4">
                  {check.checks.map((entry, index) => (
                    <li key={index} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={entry.outcome === "Approved" ? "success" : "destructive"}>{entry.outcome}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {entry.checkedByName} · {when(entry.checkedAt)}
                        </span>
                      </div>
                      {entry.comments === null ? null : (
                        <p className="text-sm whitespace-pre-wrap">{entry.comments}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
