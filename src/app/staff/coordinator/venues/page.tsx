import { notFound } from "next/navigation";

import { venueSearchSchema } from "@/adapters/inbound/venue-search-schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildSearchVenues, getCurrentCoordinator } from "@/composition/container";
import { InvalidVenueSearchError } from "@/core/domain/errors";
import type { Venue } from "@/core/domain/venue";

import { EmptyState } from "../../field-list";
import { PageHeader, StaffShell } from "../../staff-shell";
import { formatTimeOnly } from "../../time-picker";
import { VenueSearchForm, type VenueSearchValues } from "./venue-search-form";

export const metadata = { title: "Find a venue | ConnectSphere" };

function hours(venue: Venue): string {
  return venue.operatingHoursStart === null || venue.operatingHoursEnd === null
    ? "—"
    : `${formatTimeOnly(venue.operatingHoursStart)} – ${formatTimeOnly(venue.operatingHoursEnd)}`;
}

function text(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * SPM-44: the Coordinator narrows the catalogue to candidate venues. The list
 * is candidates only -- whether one is suitable is a separate step (#83).
 */
export default async function VenueSearchPage({
  searchParams,
}: PageProps<"/staff/coordinator/venues">) {
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    notFound();
  }

  const params = await searchParams;
  const initial: VenueSearchValues = {
    layout: text(params.layout),
    attendance: text(params.attendance),
    facilities: text(params.facilities),
    accessibility: text(params.accessibility),
    date: text(params.date),
    startTime: text(params.startTime),
    endTime: text(params.endTime),
  };

  let venues: readonly Venue[] = [];
  const errors: Partial<Record<keyof VenueSearchValues, string>> = {};
  const parsed = venueSearchSchema.safeParse(params);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]) as keyof VenueSearchValues;
      errors[field] ??= issue.message;
    }
  } else {
    try {
      const searchVenues = await buildSearchVenues();
      ({ venues } = await searchVenues.execute(parsed.data));
    } catch (error) {
      if (!(error instanceof InvalidVenueSearchError)) throw error;
      errors[error.field ?? "date"] = error.message;
    }
  }
  const searchable = Object.keys(errors).length === 0;

  return (
    <StaffShell role="coordinator" crumbs={[{ label: "Find a venue" }]}>
      <PageHeader
        title="Find a venue"
        description="Narrow the catalogue to venues that could host the event. Times are Singapore time. Check suitability before booking."
      />
      <div className="space-y-6">
        <VenueSearchForm initial={initial} errors={errors} />
        {!searchable ? null : venues.length === 0 ? (
          <EmptyState
            title="No venues match"
            description="Try a different time, a smaller attendance or fewer facilities."
          />
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Layouts (capacity)</TableHead>
                  <TableHead>Operating hours</TableHead>
                  <TableHead>Facilities</TableHead>
                  <TableHead>Accessibility</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venues.map((venue) => (
                  <TableRow key={venue.id}>
                    <TableCell className="font-medium">{venue.location}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {venue.layouts.map((l) => `${l.name} (${l.capacity})`).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{hours(venue)}</TableCell>
                    <TableCell className="text-muted-foreground">{venue.facilities ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {venue.accessibility ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </StaffShell>
  );
}
