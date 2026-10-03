import { StaffShell } from "../../staff-shell";
import { EquipmentCatalogueCard } from "../equipment-catalogue-card";

export const metadata = { title: "Equipment | ConnectSphere" };

export default function EquipmentPage() {
  return (
    // The list pane is the reservation queue, which this page does not use.
    <StaffShell role="technical" crumbs={[{ label: "Equipment" }]} defaultOpen={false}>
      <EquipmentCatalogueCard />
    </StaffShell>
  );
}
