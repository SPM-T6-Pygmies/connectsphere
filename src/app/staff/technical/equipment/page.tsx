import { forbidden } from "next/navigation";

import { getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../../staff-shell";
import { EquipmentCatalogueCard } from "../equipment-catalogue-card";

export const metadata = { title: "Equipment | ConnectSphere" };

export default async function EquipmentPage() {
  // Refused before the catalogue is read: only Technical Support Staff may
  // see it, and the catalogue store re-checks that on every call (SPM-16).
  if ((await getCurrentTechnicalSupport()) === null) {
    forbidden();
  }

  return (
    // The list pane is the reservation queue, which this page does not use.
    <StaffShell role="technical" crumbs={[{ label: "Equipment" }]} defaultOpen={false}>
      <EquipmentCatalogueCard />
    </StaffShell>
  );
}
