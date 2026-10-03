import { PageHeader, StaffShell } from "../../../staff-shell";
import { createVenueAction } from "../actions";
import { VenueForm } from "../venue-form";

export const metadata = { title: "Add venue | ConnectSphere" };

export default function NewVenuePage() {
  return (
    <StaffShell
      role="venue"
      crumbs={[{ label: "Venues", href: "/staff/venue/catalogue" }, { label: "Add venue" }]}
      defaultOpen={false}
    >
      <PageHeader title="Add venue" description="Create a venue record and the layouts it supports." />
      <VenueForm action={createVenueAction} />
    </StaffShell>
  );
}
