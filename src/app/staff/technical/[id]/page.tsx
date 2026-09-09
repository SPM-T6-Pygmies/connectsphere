import { AlertTriangleIcon } from "lucide-react";
import { notFound } from "next/navigation";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { reservationById } from "@/lib/wireframe";

import { EventContextPanel } from "../../event-context";
import { FieldList } from "../../field-list";
import { PageHeader, StaffShell } from "../../staff-shell";
import { StatusBadge } from "../../status-badge";

export default async function TechnicalReviewPage({
  params,
}: PageProps<"/staff/technical/[id]">) {
  const { id } = await params;
  const entry = reservationById(id);

  if (!entry) {
    notFound();
  }

  const { event, reservation } = entry;
  const support = event.support;
  const shortfall = reservation.lines.filter(
    (line) => line.quantityReserved < line.quantityRequested,
  );

  return (
    <StaffShell
      role="technical"
      crumbs={[
        { label: "Equipment reviews", href: "/staff/technical" },
        { label: event.name },
      ]}
    >
      <PageHeader
        title={event.name}
        description={`Reservation ${reservation.id} · ${event.request.preferredDate ?? "no date set"}`}
        actions={<StatusBadge status={reservation.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Equipment lines</CardTitle>
              <CardDescription>
                Each line is judged on its own. Reserving less than was asked
                for is a real outcome, not a failure to answer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Asked</TableHead>
                    <TableHead>In pool</TableHead>
                    <TableHead>Reserve</TableHead>
                    <TableHead>Fulfilment</TableHead>
                    <TableHead>Condition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservation.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.type}</TableCell>
                      <TableCell>{line.quantityRequested}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {line.quantityAvailable}
                          {line.quantityAvailable < line.quantityRequested ? (
                            <Badge variant="destructive">Short</Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={line.quantityRequested}
                          defaultValue={line.quantityReserved}
                          className="h-7 w-20"
                          aria-label={`Quantity to reserve for ${line.type}`}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={line.fulfilmentStatus} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {line.operationalStatus}
                        {line.defectNotes ? ` — ${line.defectNotes}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {shortfall.length > 0 ? (
                <Alert variant="warning">
                  <AlertTriangleIcon />
                  <AlertTitle className="line-clamp-none">
                    {shortfall.length} line
                    {shortfall.length === 1 ? "" : "s"} cannot be filled in full
                  </AlertTitle>
                  <AlertDescription>
                    <p>
                      Reserve what exists and say what is missing. Whether the
                      shortfall blocks the event is the coordinator&apos;s call,
                      not yours — it lands on their readiness view.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="returnDate">Return date</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    defaultValue={reservation.returnDate ?? ""}
                  />
                  <p className="text-muted-foreground text-xs">
                    Items are back in the pool the day after return.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button>Reserve</Button>
                <Button variant="outline">Mark unavailable</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical support</CardTitle>
              <CardDescription>
                Cover before or during the event, separate from the equipment
                itself.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="supportNeeded">Support needed</Label>
                  <p className="text-muted-foreground text-xs">
                    Not every event needs someone on site.
                  </p>
                </div>
                <Switch
                  id="supportNeeded"
                  defaultChecked={support?.supportNeeded ?? false}
                />
              </div>

              {support ? (
                <FieldList
                  fields={[
                    { label: "Timing", value: support.timing },
                    { label: "Description", value: support.description },
                    {
                      label: "Assigned staff",
                      value:
                        support.assignedStaff.length > 0
                          ? support.assignedStaff
                              .map((person) => person.name)
                              .join(", ")
                          : null,
                    },
                  ]}
                />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="clarification">
                  Raise a clarification
                </Label>
                <Textarea
                  id="clarification"
                  defaultValue={support?.clarificationLog ?? ""}
                  placeholder="What you need to know before you can commit to this."
                />
                <p className="text-muted-foreground text-xs">
                  This goes to the coordinator, not the organiser — they stay
                  the client&apos;s single point of contact. Your question and
                  their answer are kept with the event.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline">Assign myself</Button>
                <Button variant="outline">Send clarification</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <EventContextPanel event={event} />
        </div>
      </div>
    </StaffShell>
  );
}
