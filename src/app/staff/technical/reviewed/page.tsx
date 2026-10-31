import { forbidden } from "next/navigation";

import { getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../../staff-shell";
import { EquipmentQueueCard } from "../equipment-queue-card";
import { equipmentQueue } from "../../staff-queues";

export const metadata = { title: "Reviewed | ConnectSphere" };

/** SPM-273: every active event whose equipment lines are all reserved, or marked unfulfilled (SPM-274). */
export default async function ReviewedReservationsPage() {
  // Anyone who is not Technical Support Staff gets the shared access-denied screen (SPM-16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    forbidden();
  }

  const { events } = await equipmentQueue(technicalSupport.userAccountId, "reviewed");

  return (
    <StaffShell role="technical" crumbs={[{ label: "Reviewed" }]} technicalQueue="reviewed">
      <EquipmentQueueCard queue="reviewed" events={events} />
    </StaffShell>
  );
}
