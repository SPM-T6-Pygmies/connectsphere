import { forbidden } from "next/navigation";

import { buildListEquipmentQueue, getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../staff-shell";
import { EquipmentQueueCard } from "./equipment-queue-card";

export const metadata = { title: "Needs review | ConnectSphere" };

/** SPM-273: every active event with equipment needing Technical Support's attention. */
export default async function TechnicalPage() {
  // Anyone who is not Technical Support Staff is refused the list with the
  // shared access-denied screen (SPM-16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    forbidden();
  }

  const listEquipmentQueue = await buildListEquipmentQueue();
  const { events } = await listEquipmentQueue.execute({ ...technicalSupport, queue: "needsReview" });

  return (
    <StaffShell role="technical" crumbs={[{ label: "Needs review" }]}>
      <EquipmentQueueCard queue="needsReview" events={events} />
    </StaffShell>
  );
}
