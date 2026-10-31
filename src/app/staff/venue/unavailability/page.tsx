import { forbidden } from "next/navigation";

import { formatDateTime } from "@/app/events/format-event-time";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildListVenues,
  buildListVenueUnavailability,
  getCurrentVenueStaff,
  getVenueMaintenanceRoles,
} from "@/composition/container";
import { joinSlotCodes } from "@/core/domain/slot-grid";
import { formatRange } from "@/core/domain/time-of-day";
import type { VenueUnavailabilityEntry } from "@/core/domain/venue-unavailability";

import { EmptyState } from "../../field-list";
import { PageHeader, StaffShell } from "../../staff-shell";
import { LiftButton } from "./lift-button";
import { UnavailabilityForm } from "./unavailability-form";

export const metadata = { title: "Venue unavailability | ConnectSphere" };

function dates(entry: VenueUnavailabilityEntry): string {
  return entry.startDate === entry.endDate ? entry.startDate : `${entry.startDate} to ${entry.endDate}`;
}

/** The hours blocked on each day, e.g. `09:00–11:30`: the same every day of a block. */
function timesOf(entry: VenueUnavailabilityEntry): string {
  const first = entry.slots.map(({ date }) => date).sort()[0];
  const spans = joinSlotCodes(entry.slots.filter(({ date }) => date === first).map(({ slot }) => slot));
  return spans.length === 0 ? "—" : spans.map(formatRange).join(", ");
}

export default async function VenueUnavailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  // Anyone but Venue Staff gets the shared access-denied screen (SPM-16).
  const staff = await getCurrentVenueStaff();
  if (staff === null) {
    forbidden();
  }

  const { venue: defaultVenueId } = await searchParams;
  const [{ venues }, { entries }] = await Promise.all([
    buildListVenues().then((listVenues) => listVenues.execute()),
    Promise.all([buildListVenueUnavailability(), getVenueMaintenanceRoles()]).then(([list, roles]) =>
      list.execute({ roles, userAccountId: staff.userAccountId }),
    ),
  ]);

  return (
    <StaffShell
      role="venue"
      crumbs={[{ label: "Venues", href: "/staff/venue/catalogue" }, { label: "Unavailability" }]}
      defaultOpen={false}
    >
      <PageHeader
        title="Venue unavailability"
        description="Block a venue while it is out of use. Coordinators cannot request a blocked slot; existing bookings are not changed."
      />

      <UnavailabilityForm
        venues={venues.map(({ id, location, openingHours }) => ({ id, location, openingHours }))}
        defaultVenueId={defaultVenueId}
      />

      <h2 className="text-lg font-semibold">Blocks</h2>
      {entries.length === 0 ? (
        <EmptyState title="No blocks yet" description="A venue marked unavailable will be listed here." />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Times</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead>Lifted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.venueLocation}</TableCell>
                  <TableCell>{dates(entry)}</TableCell>
                  <TableCell>{timesOf(entry)}</TableCell>
                  {/* A note can be 500 characters with no spaces: let it wrap rather than push Status and Lift off screen. */}
                  <TableCell className="max-w-64 whitespace-normal [overflow-wrap:anywhere]">
                    {entry.reason}
                    {entry.note === null ? null : (
                      <span className="text-muted-foreground block text-xs">{entry.note}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.status === "In force" ? "warning" : "secondary"}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.recordedByName}
                    <span className="text-muted-foreground block text-xs">{formatDateTime(entry.recordedAt)}</span>
                  </TableCell>
                  <TableCell>
                    {entry.liftedByName === null || entry.liftedAt === null ? (
                      "—"
                    ) : (
                      <>
                        {entry.liftedByName}
                        <span className="text-muted-foreground block text-xs">{formatDateTime(entry.liftedAt)}</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell>{entry.status === "In force" ? <LiftButton unavailabilityId={entry.id} /> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </StaffShell>
  );
}
