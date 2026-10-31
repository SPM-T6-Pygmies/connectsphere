import { forbidden } from "next/navigation";

import { getCurrentTechnicalSupport } from "@/composition/container";

import { StaffShell } from "../staff-shell";
import { EquipmentQueueCard } from "./equipment-queue-card";
import { equipmentQueue } from "../staff-queues";

export const metadata = { title: "Needs review | ConnectSphere" };

/** SPM-273: every active event with equipment needing Technical Support's attention. */
export default async function TechnicalPage() {
  // Anyone who is not Technical Support Staff is refused the list with the
  // shared access-denied screen (SPM-16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    forbidden();
  }

  const { events } = await equipmentQueue(technicalSupport.userAccountId, "needsReview");

  return (
    <StaffShell role="technical" crumbs={[{ label: "Needs review" }]}>
      <EquipmentQueueCard queue="needsReview" events={events} />
    </StaffShell>
  );
}
