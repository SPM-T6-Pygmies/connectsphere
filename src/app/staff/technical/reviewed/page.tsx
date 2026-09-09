import { reviewedReservations } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";
import { EquipmentCatalogueCard } from "../equipment-catalogue-card";

export const metadata = { title: "Reviewed | ConnectSphere" };

export default function ReviewedReservationsPage() {
  const reviewed = reviewedReservations();

  return (
    <StaffShell role="technical" crumbs={[{ label: "Reviewed" }]}>
      <QueueEmptyState
        title={reviewed.length === 0 ? "Nothing reviewed yet" : "Select a reservation"}
        description={
          reviewed.length === 0
            ? "Reserved, partially reserved or unavailable requests will appear here."
            : "Choose one from the list to see its detail."
        }
      />
      <EquipmentCatalogueCard />
    </StaffShell>
  );
}
