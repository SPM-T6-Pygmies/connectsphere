import { CheckIcon, AlertTriangleIcon } from "lucide-react";
import { forbidden } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildViewCoordinatorEvent,
  buildViewEventEquipment,
  buildViewEventSafetyChecks,
  buildViewVenueBookingOptions,
  getCurrentCoordinator,
} from "@/composition/container";
import type { SafetyCheckBlocker } from "@/core/domain/safety-check";

import { detailCrumbs } from "../../../detail-origin";
import { PageHeader, StaffShell } from "../../../staff-shell";
import { StatusBadge } from "../../../status-badge";
import { ARRANGEMENT_LABELS } from "./arrangement-labels";
import { CancelEventForm } from "./cancel-event-form";
import { CompleteForm } from "./complete-form";
import { ConfirmForm } from "./confirm-form";
import { EquipmentSection } from "./equipment-section";
import { EVENT_TABS, type EventTab } from "./event-tab-names";
import { EventTabs } from "./event-tabs";
import { SafetyCheckCard } from "./safety-check-card";
import { EventDetailsTab } from "./tabs/event-tab";
import { RegistrationTab } from "./tabs/registration-tab";
import { VenueTab } from "./tabs/venue-tab";

export const metadata = { title: "Event | ConnectSphere" };

/** SPM-264 AC1-AC3: what the coordinator is told while the safety check blocks confirmation. */
const SAFETY_CHECK_BLOCKERS: Record<SafetyCheckBlocker, string> = {
  "no-check": "No safety check yet.",
  rejected: "Rejected. Make the changes and resubmit it for a safety check.",
  "awaiting-recheck": "Resubmitted; awaiting a fresh safety check.",
};

/**
 * SPM-50: one event, its essential-arrangement readiness, and the Confirm
 * gate -- a minimal page, not the tabbed workspace the old wireframe
 * envisioned (SPM-137 was cancelled before that got built). Only venue,
 * programme and registration are evaluated for completeness (SPM-144 tracks
 * deciding essentiality for the rest).
 *
 * SPM-285: split into tabs, one per area, with the Confirm gate beside every
 * tab since it is about the whole event. SPM-459: the Venue tab holds the
 * venue booking workspace; `?booking=` and `?venue=` open it on a booking or a
 * suggested venue.
 */
export default async function CoordinatorEventPage({
  params,
  searchParams,
}: PageProps<"/staff/coordinator/events/[id]">) {
  const { id } = await params;
  const { tab, booking: openedBookingId, venue: requestedVenueId } = await searchParams;
  const initialTab: EventTab = EVENT_TABS.find((candidate) => candidate === tab) ?? "event";

  // An event that is not theirs, or does not exist, gets the same access-denied
  // screen (SPM-16, #91), so a guess cannot confirm an event exists.
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    forbidden();
  }

  const viewCoordinatorEvent = await buildViewCoordinatorEvent();
  const result = await viewCoordinatorEvent.execute({ id, ...coordinator });
  if (result === null) {
    forbidden();
  }

  const viewEventEquipment = await buildViewEventEquipment();
  const equipment = await viewEventEquipment.execute({ eventId: id, ...coordinator });
  if (equipment === null) {
    forbidden();
  }

  const viewEventSafetyChecks = await buildViewEventSafetyChecks();
  const safetyChecks = await viewEventSafetyChecks.execute({ eventId: id, ...coordinator });
  if (safetyChecks === null) {
    forbidden();
  }

  const viewVenueBookingOptions = await buildViewVenueBookingOptions();
  const venueBooking = await viewVenueBookingOptions.execute({ eventId: id, ...coordinator });
  if (venueBooking === null) {
    forbidden();
  }

  const {
    event,
    details,
    clientOrganisationName,
    owningOrganiserName,
    readiness,
    confirmation,
    blockingArrangements,
    blockingEquipment,
    safetyCheckBlocker,
    canComplete,
    flaggedBookings,
    endsAt,
    canCancel,
  } = result;
  const blockers = readiness.essentialArrangements.filter((arrangement) => !arrangement.complete);

  return (
    <StaffShell
      role="coordinator"
      crumbs={detailCrumbs("coordinator", "queue", "My events", event.name, "/staff/coordinator/events")}
      coordinatorSection="events"
    >
      <PageHeader
        title={event.name}
        description={`${clientOrganisationName} · requested by ${owningOrganiserName}`}
        actions={<StatusBadge status={event.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* min-w-0: a grid item otherwise grows to its widest content, and the
            Venue tab's bookings table would push the whole page past a phone's width. */}
        <div className="min-w-0 lg:col-span-2">
          <EventTabs
            initialTab={initialTab}
            panels={{
              event: <EventDetailsTab event={event} details={details} readiness={readiness} />,
              venue: (
                <VenueTab
                  readiness={readiness}
                  flaggedBookings={flaggedBookings}
                  booking={venueBooking}
                  openedBookingId={typeof openedBookingId === "string" ? openedBookingId : undefined}
                  requestedVenueId={typeof requestedVenueId === "string" ? requestedVenueId : undefined}
                />
              ),
              equipment: <EquipmentSection equipment={equipment} />,
              safety: <SafetyCheckCard eventId={event.id} view={safetyChecks} />,
              registration: <RegistrationTab event={event} details={details} readiness={readiness} />,
            }}
          />
        </div>

        <div className="space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Confirmation</CardTitle>
              <CardDescription>
                Confirming commits ConnectSphere to the arrangements and makes them visible to the organiser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {confirmation === "already-confirmed" ? (
                <Alert>
                  <CheckIcon />
                  <AlertTitle>Already {event.status.toLowerCase()}</AlertTitle>
                </Alert>
              ) : confirmation === "not-in-planning" ? (
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>Cannot confirm -- this event is {event.status.toLowerCase()}</AlertTitle>
                  <AlertDescription>Only an event in planning can be confirmed.</AlertDescription>
                </Alert>
              ) : confirmation === "blocked" ? (
                <>
                  {blockingArrangements.length > 0 ? (
                    <Alert variant="destructive">
                      <AlertTriangleIcon />
                      <AlertTitle>
                        Cannot confirm -- {blockingArrangements.length} essential arrangement
                        {blockingArrangements.length === 1 ? "" : "s"} incomplete
                      </AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4">
                          {blockers.map((arrangement) => (
                            <li key={arrangement.type}>
                              <span className="font-medium">{ARRANGEMENT_LABELS[arrangement.type]}</span> —{" "}
                              {arrangement.detail}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {blockingEquipment.length > 0 ? (
                    <Alert variant="destructive">
                      <AlertTriangleIcon />
                      <AlertTitle>
                        Cannot confirm -- {blockingEquipment.length} essential equipment line
                        {blockingEquipment.length === 1 ? "" : "s"} not reserved in full
                      </AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4">
                          {blockingEquipment.map((equipmentType) => (
                            <li key={equipmentType}>
                              <span className="font-medium">{equipmentType}</span>
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {safetyCheckBlocker !== null ? (
                    <Alert variant="destructive">
                      <AlertTriangleIcon />
                      <AlertTitle>Cannot confirm -- safety check not approved</AlertTitle>
                      <AlertDescription>{SAFETY_CHECK_BLOCKERS[safetyCheckBlocker]}</AlertDescription>
                    </Alert>
                  ) : null}
                </>
              ) : (
                <Alert>
                  <CheckIcon />
                  <AlertTitle>Ready to confirm</AlertTitle>
                </Alert>
              )}

              {confirmation === "ready" || confirmation === "blocked" ? (
                <ConfirmForm eventId={event.id} canConfirm={confirmation === "ready"} />
              ) : null}

              {event.status === "Confirmed" ? (
                <CompleteForm
                  eventId={event.id}
                  canComplete={canComplete}
                  endsAt={endsAt}
                  operationalNotes={details.operationalNotes}
                />
              ) : null}
            </CardContent>
          </Card>

          {canCancel ? (
            <Card>
              <CardHeader>
                <CardTitle>Cancellation</CardTitle>
                <CardDescription>
                  Cancelling gives back every venue booking and hold, so they are free for other events.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CancelEventForm eventId={event.id} eventName={event.name} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </StaffShell>
  );
}
