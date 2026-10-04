import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildListVenues } from "@/composition/container";

import { EmptyState } from "../../field-list";
import { formatSlots } from "../../slot-label";
import { PageHeader, StaffShell } from "../../staff-shell";

export const metadata = { title: "Venues | ConnectSphere" };

export default async function VenueCataloguePage() {
  const listVenues = await buildListVenues();
  const { venues } = await listVenues.execute();

  return (
    <StaffShell role="venue" crumbs={[{ label: "Venues" }]} defaultOpen={false}>
      <PageHeader
        title="Venues"
        description="The catalogue Event Coordinators search when they book a venue."
        actions={
          <Button asChild size="sm">
            <Link href="/staff/venue/catalogue/new">
              <PlusIcon /> Add venue
            </Link>
          </Button>
        }
      />
      {venues.length === 0 ? (
        <EmptyState title="No venues yet" description="Add the first venue to the catalogue." />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Layouts (capacity)</TableHead>
                <TableHead>Slots</TableHead>
                <TableHead>Facilities</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.map((venue) => (
                <TableRow key={venue.id}>
                  <TableCell>
                    <Link
                      href={`/staff/venue/catalogue/${venue.id}`}
                      className="font-medium hover:underline"
                    >
                      {venue.location}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{venue.capacity ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {venue.layouts.length === 0
                      ? "—"
                      : venue.layouts.map((l) => `${l.name} (${l.capacity})`).join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatSlots(venue.slots)}</TableCell>
                  <TableCell className="text-muted-foreground">{venue.facilities ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </StaffShell>
  );
}
