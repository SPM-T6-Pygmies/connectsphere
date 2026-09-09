import { submittedRequests } from "@/lib/wireframe";

import { QueueEmptyState } from "../../queue-empty-state";
import { StaffShell } from "../../staff-shell";

export const metadata = { title: "Submitted | ConnectSphere" };

export default function SubmittedRequestsPage() {
  const submitted = submittedRequests();

  return (
    <StaffShell role="requester" crumbs={[{ label: "Submitted" }]}>
      <QueueEmptyState
        title={submitted.length === 0 ? "Nothing submitted yet" : "Select a request"}
        description={
          submitted.length === 0
            ? "Submit a draft and it moves here."
            : "Choose one from the list to see its details."
        }
      />
    </StaffShell>
  );
}
