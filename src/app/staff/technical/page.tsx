import { reservationsNeedingReview } from "@/lib/wireframe";

import { QueueEmptyState } from "../queue-empty-state";
import { StaffShell } from "../staff-shell";
import { EquipmentCatalogueCard } from "./equipment-catalogue-card";

export const metadata = { title: "Needs review | ConnectSphere" };

export default function TechnicalPage() {
  const needsReview = reservationsNeedingReview();

  return (
    <StaffShell role="technical" crumbs={[{ label: "Needs review" }]}>
      <QueueEmptyState
        title={needsReview.length === 0 ? "No equipment requests" : "Select a reservation"}
        description={
          needsReview.length === 0
            ? "Reservations to review will appear here."
            : "Choose one from the list to review it."
        }
      />
      <EquipmentCatalogueCard />
    </StaffShell>
  );
}
