import { forbidden } from "next/navigation";

import { buildViewCoordinatorWorkloads, getCurrentCoordinatorLead } from "@/composition/container";

import { StaffShell } from "../../staff-shell";
import { CoordinatorWorkloadCard } from "./coordinator-workload-card";

export const metadata = { title: "Coordinators | ConnectSphere" };

/** SPM-256: every coordinator with the requests and active events assigned to them. */
export default async function CoordinatorsPage() {
  // A Server Component is reached only through its route, but the read below
  // needs the Lead's own id -- anyone else gets the shared access-denied screen.
  const lead = await getCurrentCoordinatorLead();
  if (lead === null) {
    forbidden();
  }

  const viewCoordinatorWorkloads = await buildViewCoordinatorWorkloads();
  const { coordinators } = await viewCoordinatorWorkloads.execute({
    leadUserAccountId: lead.userAccountId,
  });

  return (
    <StaffShell role="lead" crumbs={[{ label: "Coordinators" }]} defaultOpen={false}>
      <div className="space-y-6">
        {coordinators.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Event Coordinators yet</p>
        ) : (
          coordinators.map((coordinator) => (
            <CoordinatorWorkloadCard key={coordinator.userAccountId} coordinator={coordinator} />
          ))
        )}
      </div>
    </StaffShell>
  );
}
