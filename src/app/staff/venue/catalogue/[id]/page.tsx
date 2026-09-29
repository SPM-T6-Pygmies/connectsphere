import { notFound } from "next/navigation";

import { buildViewVenue } from "@/composition/container";
import { VenueNotFoundError } from "@/core/domain/errors";

import { PageHeader, StaffShell } from "../../../staff-shell";
import { updateVenueAction } from "../actions";
import { VenueForm } from "../venue-form";

export const metadata = { title: "Venue | ConnectSphere" };

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const viewVenue = await buildViewVenue();
  const { venue } = await viewVenue.execute({ venueId: id }).catch((error) => {
    if (error instanceof VenueNotFoundError) notFound();
    throw error;
  });

  return (
    <StaffShell
      role="venue"
      crumbs={[{ label: "Venues", href: "/staff/venue/catalogue" }, { label: venue.location }]}
      defaultOpen={false}
    >
      <PageHeader title={venue.location} description="Edit this venue's record and supported layouts." />
      {/* Keyed on the stored record so a saved change re-seeds the form. */}
      <VenueForm key={JSON.stringify(venue)} action={updateVenueAction} venue={venue} />
    </StaffShell>
  );
}
