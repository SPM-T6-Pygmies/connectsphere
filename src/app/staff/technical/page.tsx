import { notFound } from "next/navigation";

import { buildListEquipmentRechecks, getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../staff-shell";
import { EquipmentCatalogueCard } from "./equipment-catalogue-card";
import { EquipmentRechecksCard } from "./equipment-rechecks-card";

export const metadata = { title: "Needs review | ConnectSphere" };

export default async function TechnicalPage() {
  // Anyone who is not Technical Support Staff is refused the list (SPM-41 AC16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    notFound();
  }

  const listEquipmentRechecks = await buildListEquipmentRechecks();
  const { rechecks } = await listEquipmentRechecks.execute(technicalSupport);

  return (
    <StaffShell role="technical" crumbs={[{ label: "Needs review" }]}>
      <EquipmentRechecksCard rechecks={rechecks} />
      <EquipmentCatalogueCard />
    </StaffShell>
  );
}
