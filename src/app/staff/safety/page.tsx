import { forbidden } from "next/navigation";

import { buildListEventsAwaitingSafetyCheck, getCurrentSafetyOfficer } from "@/composition/container";

import { StaffShell } from "../staff-shell";
import { EventsAwaitingCheckCard } from "./events-awaiting-check-card";

export const metadata = { title: "Awaiting check | ConnectSphere" };

/** The Safety Officer's workspace (SPM-258): the events awaiting a safety check (SPM-259). */
export default async function SafetyPage() {
  // Anyone who is not a Safety Officer is refused the list with the shared
  // access-denied screen (SPM-259 AC7, SPM-16).
  const safetyOfficer = await getCurrentSafetyOfficer();
  if (safetyOfficer === null) {
    forbidden();
  }

  const listEventsAwaitingSafetyCheck = await buildListEventsAwaitingSafetyCheck();
  const { events } = await listEventsAwaitingSafetyCheck.execute(safetyOfficer);

  return (
    <StaffShell role="safety" crumbs={[{ label: "Awaiting check" }]}>
      <EventsAwaitingCheckCard events={events} />
    </StaffShell>
  );
}
