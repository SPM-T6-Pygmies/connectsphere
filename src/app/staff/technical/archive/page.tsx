import { archivedReservations } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";
import { EquipmentCatalogueCard } from "../equipment-catalogue-card";

export const metadata = { title: "Archive | ConnectSphere" };

export default function ArchivedReservationsPage() {
  const archived = archivedReservations();

  return (
    <StaffShell role="technical" crumbs={[{ label: "Archive" }]}>
      <QueueEmptyState
        title={archived.length === 0 ? "Nothing archived" : "Select a reservation"}
        description={
          archived.length === 0
            ? "Released or returned reservations will appear here."
            : "Choose one from the list to see its history."
        }
      />
      <EquipmentCatalogueCard />
    </StaffShell>
  );
}
