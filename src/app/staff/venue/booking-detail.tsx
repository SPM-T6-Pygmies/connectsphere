import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import { forbidden } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildReviewBookingRequests, getCurrentVenueStaff } from "@/composition/container";
import { BookingNotFoundError } from "@/core/domain/errors";
import type { BookingReviewDetail } from "@/core/use-cases/review-booking-requests";

import { FieldList } from "../field-list";
import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell, type VenueSection } from "../staff-shell";
import { StatusBadge } from "../status-badge";
import { DecisionForm } from "./[id]/decision-form";

/** `h:mm am/pm` in Singapore time -- the system runs on Singapore time only (#36). */
function formatInstantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatInstantDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

function sectionOf(status: string): {
  section: VenueSection;
  queueLabel: string;
  queueHref: string;
} {
  if (status === "Requested") {
    return { section: "requests", queueLabel: "Requests", queueHref: "/staff/venue" };
  }
  if (status === "Tentative Hold" || status === "Confirmed") {
    return { section: "decided", queueLabel: "Decided", queueHref: "/staff/venue/decided" };
  }
  return { section: "archive", queueLabel: "Archive", queueHref: "/staff/venue/archive" };
}

function FitAlert({ detail }: { detail: BookingReviewDetail }) {
  const { booking, venue } = detail;
  const needed = booking.event.expectedAttendance;
  const layout = venue?.layouts.find((candidate) => candidate.name === booking.roomLayoutName);
  const capacity = layout?.capacity ?? venue?.capacity ?? null;

  if (needed === null || capacity === null) {
    return null;
  }

  const fits = capacity >= needed;
  return (
    <Alert variant={fits ? "default" : "warning"}>
      {fits ? <CheckIcon /> : <AlertTriangleIcon />}
      <AlertTitle>
        {fits
          ? `Capacity is sufficient — ${needed} expected, ${layout ? "this layout" : "the room"} holds ${capacity}`
          : `Over capacity — ${needed} expected, ${layout ? "this layout" : "the room"} holds ${capacity}`}
      </AlertTitle>
    </Alert>
  );
}

/**
 * SPM-22: one booking request beside the venue it is for, and the decision.
 *
 * Venue Staff only; anyone else, and any booking that does not exist, get the
 * same refusal (#91). The same body renders under the booking's own route and
 * under the inbox.
 */
export async function BookingDetail({
  id,
  origin = "queue",
}: {
  id: string;
  origin?: DetailOrigin;
}) {
  const staff = await getCurrentVenueStaff();
  if (staff === null) {
    forbidden();
  }

  const reviewBookingRequests = await buildReviewBookingRequests();
  let detail: BookingReviewDetail;
  try {
    detail = await reviewBookingRequests.open(staff.userAccountId, id);
  } catch (error) {
    if (error instanceof BookingNotFoundError) {
      forbidden();
    }
    throw error;
  }

  const { booking, venue, alternatives } = detail;
  const { event } = booking;
  const decided = booking.status !== "Requested";
  const { section, queueLabel, queueHref } = sectionOf(booking.status);
  const eventTime =
    event.startTime !== null && event.endTime !== null
      ? `${formatInstantTime(event.startTime)} – ${formatInstantTime(event.endTime)}`
      : null;
  const slots = booking.slots.map(({ date, slot }) => `${date} ${slot}`).join(", ");

  return (
    <StaffShell
      role="venue"
      venueSection={section}
      crumbs={detailCrumbs("venue", origin, queueLabel, booking.venueLocation, queueHref)}
    >
      <PageHeader
        title={booking.venueLocation}
        description={`${slots} · requested by ${booking.requestedByName} on ${formatInstantDate(booking.requestedAt)}`}
        actions={<StatusBadge status={booking.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Fit against this venue</CardTitle>
              <CardDescription>
                What the coordinator asked for, checked against what this room actually is.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FitAlert detail={detail} />

              {venue === null ? (
                <p className="text-muted-foreground text-sm">
                  This venue is no longer in the catalogue.
                </p>
              ) : (
                <>
                  <FieldList
                    fields={[
                      { label: "Capacity", value: venue.capacity },
                      {
                        label: "Slots",
                        value: venue.slots.length > 0 ? venue.slots.join(", ") : null,
                      },
                      { label: "Facilities", value: venue.facilities },
                      { label: "Accessibility", value: venue.accessibility },
                    ]}
                  />

                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                      Supported layouts
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {venue.layouts.map((layout) => (
                        <Badge
                          key={layout.name}
                          variant={layout.name === booking.roomLayoutName ? "default" : "outline"}
                        >
                          {layout.name} · {layout.capacity}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs">
                      The coordinator asked for {booking.roomLayoutName ?? "no particular layout"}.
                      Capacity is per layout, not one number for the room.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
              <CardDescription>
                Approving confirms this booking and holds the venue for the slots above. Nothing
                else can take them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {decided ? (
                <Alert variant={booking.status === "Rejected" ? "destructive" : "default"}>
                  {booking.status === "Rejected" ? <AlertTriangleIcon /> : <CheckIcon />}
                  <AlertTitle>
                    Already decided — {booking.status}
                    {booking.decidedByName ? ` by ${booking.decidedByName}` : ""}
                  </AlertTitle>
                  {booking.rejectionNote ? (
                    <AlertDescription>
                      <p>{booking.rejectionNote}</p>
                      {booking.suggestedAlternativeLocation ? (
                        <p>Suggested instead: {booking.suggestedAlternativeLocation}</p>
                      ) : null}
                    </AlertDescription>
                  ) : null}
                </Alert>
              ) : (
                <DecisionForm
                  bookingId={booking.id}
                  alternatives={alternatives.map((candidate) => ({
                    id: candidate.id,
                    location: candidate.location,
                    capacity: candidate.capacity,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>{event.name}</CardTitle>
              <CardDescription>
                {event.organisationName ?? "No organisation"} · {event.status}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldList
                columns={1}
                fields={[
                  { label: "Category", value: event.category },
                  { label: "Date", value: event.preferredDate },
                  { label: "Time", value: eventTime },
                  { label: "Expected attendance", value: event.expectedAttendance },
                  { label: "Room layout", value: event.roomLayoutPreference },
                  { label: "Accessibility needs", value: event.accessibilityRequirements },
                  { label: "Venue requirements", value: event.venueRequirements },
                  { label: "Equipment requirements", value: event.equipmentRequirements },
                  { label: "Other arrangements", value: event.specialArrangements },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
