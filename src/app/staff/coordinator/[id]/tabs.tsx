import {
  AlertTriangleIcon,
  CheckIcon,
  LockIcon,
  MinusIcon,
} from "lucide-react";
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
import {
  blockingArrangements,
  canConfirm,
  candidateVenues,
  liveRegistrations,
  registrationUnlocked,
  type EventRecord,
} from "@/lib/wireframe";

import { EmptyState, FieldList } from "../../field-list";
import { StatusBadge } from "../../status-badge";

export function OverviewTab({ event }: { event: EventRecord }) {
  const request = event.request;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>The request as submitted</CardTitle>
            <CardDescription>
              Everything the organiser supplied. Gaps here are what the
              clarification thread is for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldList
              fields={[
                { label: "Category", value: request.categoryType },
                { label: "Preferred date", value: request.preferredDate },
                { label: "Preferred time", value: request.preferredTime },
                {
                  label: "Expected attendance",
                  value: request.expectedAttendance,
                },
                { label: "Room layout", value: request.roomLayoutPreferences },
                { label: "Description", value: request.description },
                { label: "Purpose", value: request.purpose },
                { label: "Venue requirements", value: request.venueRequirements },
                {
                  label: "Accessibility needs",
                  value: request.accessibilityNeeds,
                },
                {
                  label: "Equipment requirements",
                  value: request.equipmentRequirements,
                },
                {
                  label: "Registration requirements",
                  value: request.registrationRequirements,
                },
                { label: "Programme", value: request.generalProgramme },
                {
                  label: "Other arrangements",
                  value: request.otherSpecialArrangements,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clarifications</CardTitle>
            <CardDescription>
              You are the client&apos;s single point of contact. Technical
              support can raise questions here, but the response to the
              organiser comes from you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing raised yet.
              </p>
            ) : (
              event.comments.map((comment) => (
                <div key={comment.id} className="border-l-2 pl-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {comment.author.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {comment.createdAt}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{comment.body}</p>
                </div>
              ))
            )}
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="newComment">Ask the organiser something</Label>
              <Textarea
                id="newComment"
                placeholder="What needs clarifying before this can be approved?"
              />
              <Button size="sm">Send to organiser</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>
              Approving says the request holds enough information to plan
              against. It commits no venue, equipment or staff.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {request.decisionRecord ? (
              <p className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed">
                {request.decisionRecord}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="decisionNote">Decision record</Label>
              <Textarea
                id="decisionNote"
                placeholder="Why this was approved, returned or rejected."
                defaultValue={request.decisionRecord ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button>Approve — planning may proceed</Button>
              <Button variant="outline">Return for amendment</Button>
              <Button variant="destructive">Reject</Button>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Whether a rejected request can be resubmitted is an open question
              the customer left to the team.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldList
              columns={1}
              fields={[
                { label: "Client", value: request.clientOrganisation },
                { label: "Organiser", value: request.requestedBy.name },
                { label: "Coordinator", value: event.coordinator?.name },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function VenueTab({ event }: { event: EventRecord }) {
  const booking = event.booking;
  const needed = event.request.expectedAttendance ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What the venue has to satisfy</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList
            fields={[
              { label: "Date", value: event.request.preferredDate },
              { label: "Time", value: event.request.preferredTime },
              { label: "Expected attendance", value: needed || null },
              { label: "Layout", value: event.request.roomLayoutPreferences },
              {
                label: "Venue requirements",
                value: event.request.venueRequirements,
              },
              {
                label: "Accessibility",
                value: event.request.accessibilityNeeds,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking</CardTitle>
          <CardDescription>
            Venues are booked in AM, PM and Night slots. A venue can hold only
            one live booking per slot — double-booking is blocked outright, not
            warned about.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {booking ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={booking.status} />
                <span className="text-sm font-medium">
                  {booking.venue.location}
                </span>
                <span className="text-muted-foreground text-sm">
                  {booking.slotDate} · {booking.slots.join(" + ")}
                </span>
              </div>

              {booking.status === "Rejected" ? (
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>Rejected by venue staff</AlertTitle>
                  <AlertDescription>
                    <p>{booking.rejectionNote}</p>
                    {booking.suggestedAlternativeVenue ? (
                      <p className="mt-2">
                        Suggested instead:{" "}
                        <span className="font-medium">
                          {booking.suggestedAlternativeVenue}
                        </span>
                        . A suggestion is informal — raising the new booking is
                        yours to do.
                      </p>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              <FieldList
                fields={[
                  { label: "Requested by", value: booking.requestedBy.name },
                  { label: "Requested on", value: booking.requestedAt },
                  {
                    label: "Decided by",
                    value: booking.decidedBy?.name ?? null,
                  },
                  { label: "Venue capacity", value: booking.venue.capacity },
                ]}
              />
            </div>
          ) : (
            <EmptyState
              title="No booking raised"
              description="Pick a venue below and request it."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidate venues</CardTitle>
          <CardDescription>
            Checked against the {needed || "—"} people expected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Layouts</TableHead>
                <TableHead>Accessibility</TableHead>
                <TableHead>Setup / turnaround</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidateVenues(event).map(({ venue, sufficientCapacity }) => (
                <TableRow key={venue.id}>
                  <TableCell className="font-medium">
                    {venue.location}
                    <div className="text-muted-foreground text-xs font-normal">
                      {venue.facilities}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {venue.capacity}
                      {sufficientCapacity ? (
                        <CheckIcon className="size-3.5 text-emerald-600" />
                      ) : (
                        <Badge variant="destructive">Too small</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {venue.supportedLayouts
                      .map((layout) => `${layout.name} (${layout.capacity})`)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {venue.accessibility}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {venue.setupTimeMinutes} / {venue.turnaroundTimeMinutes} min
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!sufficientCapacity}
                    >
                      Request
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function TechnicalTab({ event }: { event: EventRecord }) {
  const reservation = event.equipment;
  const support = event.support;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What the organiser asked for</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList
            columns={1}
            fields={[
              {
                label: "Equipment requirements",
                value: event.request.equipmentRequirements,
              },
              {
                label: "Other arrangements",
                value: event.request.otherSpecialArrangements,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment reservation</CardTitle>
          <CardDescription>
            Technical support judges each line on its own, so a reservation can
            be part-filled rather than simply reserved or not.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reservation ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={reservation.status} />
                {reservation.reviewedBy ? (
                  <span className="text-muted-foreground text-sm">
                    Reviewed by {reservation.reviewedBy.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    Not yet reviewed
                  </span>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Fulfilment</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservation.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.type}</TableCell>
                      <TableCell>{line.quantityRequested}</TableCell>
                      <TableCell>{line.quantityReserved}</TableCell>
                      <TableCell>
                        <StatusBadge status={line.fulfilmentStatus} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {line.defectNotes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-muted-foreground text-xs leading-relaxed">
                A shortfall does not decide itself. Whether an unfulfilled line
                blocks this event is your judgement, recorded on the Readiness
                tab.
              </p>
            </div>
          ) : (
            <EmptyState
              title="No equipment recorded"
              description="This event has no equipment requirements yet."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical support</CardTitle>
        </CardHeader>
        <CardContent>
          {support ? (
            <div className="space-y-4">
              <FieldList
                fields={[
                  {
                    label: "Support needed",
                    value: support.supportNeeded ? "Yes" : "No",
                  },
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
              {support.clarificationLog ? (
                <Alert variant="warning">
                  <AlertTriangleIcon />
                  <AlertTitle>Clarification raised by technical support</AlertTitle>
                  <AlertDescription>
                    <p>{support.clarificationLog}</p>
                  </AlertDescription>
                </Alert>
              ) : null}
              {support.response ? (
                <FieldList
                  columns={1}
                  fields={[{ label: "Response", value: support.response }]}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No support request"
              description="This event has no technical requirements recorded."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReadinessTab({ event }: { event: EventRecord }) {
  const blocking = blockingArrangements(event);
  const confirmable = canConfirm(event);
  const alreadyConfirmed =
    event.status === "Confirmed" || event.status === "Completed";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Arrangements</CardTitle>
            <CardDescription>
              There is no fixed list that applies to every event. Which
              arrangements are essential is decided per event — some need no
              equipment, support or registration at all.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {event.arrangements.length === 0 ? (
              <EmptyState
                title="No arrangements recorded"
                description="Nothing has been identified as needed for this event yet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arrangement</TableHead>
                    <TableHead>Essential</TableHead>
                    <TableHead>Complete</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {event.arrangements.map((arrangement) => (
                    <TableRow key={arrangement.type}>
                      <TableCell className="font-medium">
                        {arrangement.label}
                      </TableCell>
                      <TableCell>
                        {arrangement.essential ? (
                          <Badge variant="secondary">Essential</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Optional
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {arrangement.complete ? (
                          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                            <CheckIcon className="size-3.5" /> Done
                          </span>
                        ) : (
                          <span
                            className={
                              arrangement.essential
                                ? "text-destructive flex items-center gap-1.5 text-sm"
                                : "text-muted-foreground flex items-center gap-1.5 text-sm"
                            }
                          >
                            <MinusIcon className="size-3.5" /> Outstanding
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {arrangement.detail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Confirmation</CardTitle>
            <CardDescription>
              Confirming commits ConnectSphere to the arrangements and makes
              them visible to the organiser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alreadyConfirmed ? (
              <Alert>
                <CheckIcon />
                <AlertTitle>Already {event.status.toLowerCase()}</AlertTitle>
                <AlertDescription>
                  <p>
                    Every essential arrangement was complete when this event was
                    confirmed.
                  </p>
                </AlertDescription>
              </Alert>
            ) : blocking.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangleIcon />
                <AlertTitle className="line-clamp-none">
                  Cannot confirm — {blocking.length} essential arrangement
                  {blocking.length === 1 ? "" : "s"} incomplete
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {blocking.map((row) => (
                      <li key={row.type}>
                        <span className="font-medium">{row.label}</span> —{" "}
                        {row.detail}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckIcon />
                <AlertTitle>Ready to confirm</AlertTitle>
                <AlertDescription>
                  <p>
                    Every essential arrangement is complete. Non-essential items
                    may still be outstanding — that does not block confirmation.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <Button className="w-full" disabled={!confirmable}>
              Confirm event
            </Button>

            {!alreadyConfirmed ? (
              <Button variant="destructive" className="w-full">
                Cancel event
              </Button>
            ) : null}
            <p className="text-muted-foreground text-xs leading-relaxed">
              Only the assigned coordinator can cancel an event, and it can be
              done at any stage.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function RegistrationTab({ event }: { event: EventRecord }) {
  const unlocked = registrationUnlocked(event);
  const taken = liveRegistrations(event);

  if (!unlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockIcon className="size-4" />
            Registration is locked
          </CardTitle>
          <CardDescription>
            Attendees can register for confirmed events where registration is
            enabled. This event is {event.status.toLowerCase()}, so there is
            nothing to configure yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="warning">
            <LockIcon />
            <AlertTitle>Confirm the event first</AlertTitle>
            <AlertDescription>
              <p>
                Registration settings unlock once the event is confirmed. See
                the Readiness tab for what is still outstanding.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Registration settings</CardTitle>
            <CardDescription>
              The window is yours to set and is separate from the event dates.
              It can be extended after closing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="registrationEnabled">
                  Registration enabled
                </Label>
                <p className="text-muted-foreground text-xs">
                  Off means attendees cannot register even while confirmed.
                </p>
              </div>
              <Switch
                id="registrationEnabled"
                defaultChecked={event.registrationEnabled}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="registrationOpenDate">Opens</Label>
                <Input
                  id="registrationOpenDate"
                  type="date"
                  defaultValue={event.registrationOpenDate ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registrationCloseDate">Closes</Label>
                <Input
                  id="registrationCloseDate"
                  type="date"
                  defaultValue={event.registrationCloseDate ?? ""}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eventCapacity">Capacity</Label>
              <Input
                id="eventCapacity"
                type="number"
                min={0}
                defaultValue={event.eventCapacity ?? ""}
              />
              <p className="text-muted-foreground text-xs">
                Whether this is set independently or derived from the booked
                venue&apos;s capacity is an open team decision. The venue holds{" "}
                {event.booking?.venue.capacity ?? "—"}.
              </p>
            </div>

            <div className="flex gap-2">
              <Button>Save settings</Button>
              <Button variant="outline" asChild>
                <Link href={`/events/${event.id}`}>View the public page</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
            <CardDescription>
              {taken} live of {event.eventCapacity ?? "unlimited"} places.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {event.registrations.length === 0 ? (
              <EmptyState title="Nobody has registered yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {event.registrations.map((registration) => (
                    <TableRow key={registration.id}>
                      <TableCell className="font-medium">
                        {registration.attendeeName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {registration.attendeeEmail}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={registration.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {registration.registeredAt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Places</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {taken}
              <span className="text-muted-foreground text-base font-normal">
                {" "}
                / {event.eventCapacity ?? "∞"}
              </span>
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Withdrawn registrations release their place, so they do not count
              here. Release 1 has no waiting list — a full event simply refuses.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendees added off-system</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Attendees who do not self-register — VIPs, for instance — are
              given to you to process rather than added by the organiser.
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              Add an attendee
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
