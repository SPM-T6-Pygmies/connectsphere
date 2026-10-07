import { forbidden } from "next/navigation";

import { buildListEquipmentQueue, getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../../staff-shell";
import { EquipmentQueueCard } from "../equipment-queue-card";

export const metadata = { title: "Archive | ConnectSphere" };

/** SPM-273: every Completed or Cancelled event that had equipment. */
export default async function ArchivedReservationsPage() {
  // Anyone who is not Technical Support Staff gets the shared access-denied screen (SPM-16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    forbidden();
  }

  const listEquipmentQueue = await buildListEquipmentQueue();
  const { events } = await listEquipmentQueue.execute({ ...technicalSupport, queue: "archive" });

  return (
    <StaffShell role="technical" crumbs={[{ label: "Archive" }]} technicalQueue="archive">
      <EquipmentQueueCard queue="archive" events={events} />
    </StaffShell>
  );
}
