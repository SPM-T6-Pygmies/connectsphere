import { AlertTriangleIcon, CheckIcon } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookingById, VENUES } from "@/lib/wireframe";

import { EventContextPanel } from "../../event-context";
import { FieldList } from "../../field-list";
import { PageHeader, StaffShell } from "../../staff-shell";
import { StatusBadge } from "../../status-badge";

export default async function VenueDecisionPage({
  params,
}: PageProps<"/staff/venue/[id]">) {
  const { id } = await params;
  const entry = bookingById(id);

  if (!entry) {
    notFound();
  }

  const { event, booking } = entry;
  const venue = booking.venue;
  const needed = event.request.expectedAttendance ?? 0;
  const fits = (venue.capacity ?? 0) >= needed;
  const decided = booking.status !== "Requested";

  return (
    <StaffShell
      role="venue"
      crumbs={[
        { label: "Booking requests", href: "/staff/venue" },
        { label: venue.location },
      ]}
    >
      <PageHeader
        title={venue.location}
        description={`${booking.slotDate} · ${booking.slots.join(" + ")} · requested by ${booking.requestedBy.name} on ${booking.requestedAt}`}
        actions={<StatusBadge status={booking.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Fit against this venue</CardTitle>
              <CardDescription>
                What the coordinator asked for, checked against what this room
                actually is.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant={fits ? "default" : "warning"}>
                {fits ? <CheckIcon /> : <AlertTriangleIcon />}
                <AlertTitle>
                  {fits
                    ? `Capacity is sufficient — ${needed} expected, room holds ${venue.capacity}`
                    : `Over capacity — ${needed} expected, room holds ${venue.capacity}`}
                </AlertTitle>
              </Alert>

              <FieldList
                fields={[
                  { label: "Capacity", value: venue.capacity },
                  { label: "Operating hours", value: venue.operatingHours },
                  { label: "Facilities", value: venue.facilities },
                  { label: "Accessibility", value: venue.accessibility },
                  {
                    label: "Setup time",
                    value: `${venue.setupTimeMinutes} minutes`,
                  },
                  {
                    label: "Turnaround time",
                    value: `${venue.turnaroundTimeMinutes} minutes`,
                  },
                ]}
              />

              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Supported layouts
                </p>
                <div className="flex flex-wrap gap-2">
                  {venue.supportedLayouts.map((layout) => (
                    <Badge
                      key={layout.name}
                      variant={
                        layout.name === event.request.roomLayoutPreferences
                          ? "default"
                          : "outline"
                      }
                    >
                      {layout.name} · {layout.capacity}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  The coordinator asked for{" "}
                  {event.request.roomLayoutPreferences ?? "no particular layout"}
                  . Capacity is per layout, not one number for the room.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
              <CardDescription>
                Approving holds this venue for the slots above. Nothing else can
                take them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {decided ? (
                <Alert
                  variant={
                    booking.status === "Rejected" ? "destructive" : "default"
                  }
                >
                  {booking.status === "Rejected" ? (
                    <AlertTriangleIcon />
                  ) : (
                    <CheckIcon />
                  )}
                  <AlertTitle>
                    Already decided — {booking.status}
                    {booking.decidedBy ? ` by ${booking.decidedBy.name}` : ""}
                  </AlertTitle>
                  {booking.rejectionNote ? (
                    <AlertDescription>
                      <p>{booking.rejectionNote}</p>
                    </AlertDescription>
                  ) : null}
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="decisionNote">Note to the coordinator</Label>
                <Textarea
                  id="decisionNote"
                  defaultValue={booking.rejectionNote ?? ""}
                  placeholder="Required if you reject — say why, so the coordinator can act on it."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alternativeVenue">
                  Suggest an alternative (optional)
                </Label>
                <select
                  id="alternativeVenue"
                  defaultValue={booking.suggestedAlternativeVenue ?? ""}
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3"
                >
                  <option value="">No suggestion</option>
                  {VENUES.filter((candidate) => candidate.id !== venue.id).map(
                    (candidate) => (
                      <option key={candidate.id} value={candidate.location}>
                        {candidate.location} (holds {candidate.capacity})
                      </option>
                    ),
                  )}
                </select>
                <p className="text-muted-foreground text-xs">
                  A suggestion is informal. It does not create a booking — the
                  coordinator raises the new request.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={decided}>Approve booking</Button>
                <Button variant="outline" disabled={decided}>
                  Hold tentatively
                </Button>
                <Button variant="destructive" disabled={decided}>
                  Reject
                </Button>
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
