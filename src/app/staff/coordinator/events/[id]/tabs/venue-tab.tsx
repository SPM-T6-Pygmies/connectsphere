import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ViewCoordinatorEventResult } from "@/core/use-cases/view-coordinator-event";

import { ArrangementStatus } from "./arrangement-status";

/**
 * SPM-285: what the event needs from a venue. Booking itself stays on the
 * venue booking page, which is keyed by the source request, so an event with
 * no request gets no link.
 */
export function VenueTab({ details, readiness }: Pick<ViewCoordinatorEventResult, "details" | "readiness">) {
  const needs = [
    ["Venue requirements", details.venueRequirements],
    ["Facilities needed", details.requiredFacilities],
    ["Room layout", details.roomLayoutPreference],
    ["Accessibility", details.accessibilityRequirements],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Venue</CardTitle>
        <CardDescription>What the event needs from a venue, and whether one is booked.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ArrangementStatus readiness={readiness} type="venue" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {needs.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="break-words whitespace-pre-line">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {details.eventRequestId === null ? null : (
          <Button asChild variant="outline">
            <Link href={`/staff/coordinator/${details.eventRequestId}/venue-booking`}>
              Manage venue booking
              <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
