import { forbidden } from "next/navigation";

import { buildListEquipmentQueue, getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../../staff-shell";
import { EquipmentQueueCard } from "../equipment-queue-card";

export const metadata = { title: "Reviewed | ConnectSphere" };

/** SPM-273: every active event whose equipment lines are all reserved. */
export default async function ReviewedReservationsPage() {
  // Anyone who is not Technical Support Staff gets the shared access-denied screen (SPM-16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    forbidden();
  }

  const listEquipmentQueue = await buildListEquipmentQueue();
  const { events } = await listEquipmentQueue.execute({ ...technicalSupport, queue: "reviewed" });

  return (
    <StaffShell role="technical" crumbs={[{ label: "Reviewed" }]} technicalQueue="reviewed">
      <EquipmentQueueCard queue="reviewed" events={events} />
    </StaffShell>
  );
}
