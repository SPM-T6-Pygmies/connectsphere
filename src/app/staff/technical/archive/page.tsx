import { forbidden } from "next/navigation";

import { getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../../staff-shell";
import { EquipmentQueueCard } from "../equipment-queue-card";
import { equipmentQueue } from "../../staff-queues";

export const metadata = { title: "Archive | ConnectSphere" };

/** SPM-273: every Completed or Cancelled event that had equipment. */
export default async function ArchivedReservationsPage() {
  // Anyone who is not Technical Support Staff gets the shared access-denied screen (SPM-16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    forbidden();
  }

  const { events } = await equipmentQueue(technicalSupport.userAccountId, "archive");

  return (
    <StaffShell role="technical" crumbs={[{ label: "Archive" }]} technicalQueue="archive">
      <EquipmentQueueCard queue="archive" events={events} />
    </StaffShell>
  );
}
