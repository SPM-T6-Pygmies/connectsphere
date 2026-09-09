import { draftRequests } from "@/lib/wireframe";

import { QueueEmptyState } from "../queue-empty-state";
import { StaffShell } from "../staff-shell";

export const metadata = { title: "Drafts | ConnectSphere" };

export default function RequesterPage() {
  const drafts = draftRequests();

  return (
    <StaffShell role="requester" crumbs={[{ label: "Drafts" }]}>
      <QueueEmptyState
        title={drafts.length === 0 ? "No drafts" : "Select a draft"}
        description={
          drafts.length === 0
            ? "Requests you save before submitting will appear here."
            : "Choose one from the list to keep editing it."
        }
      />
    </StaffShell>
  );
}
