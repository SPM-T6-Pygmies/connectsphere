import { forbidden } from "next/navigation";

import { buildViewOrganiserEventRequest, getCurrentOrganiser } from "@/composition/container";

import { PageHeader, StaffShell } from "../../../staff-shell";
import { ChangeRequestForm } from "./change-request-form";

/** SPM-52: the event's owning Organiser asks for significant fields to change. */
export default async function Page({ params }: PageProps<"/staff/requester/[id]/change-request">) {
  const { id } = await params;
  const organiser = await getCurrentOrganiser();
  if (organiser === null) {
    forbidden();
  }

  const viewOrganiserEventRequest = await buildViewOrganiserEventRequest();
  const result = await viewOrganiserEventRequest.execute({ id, ...organiser });
  if (result === null || result.changeRequest === "none") {
    forbidden();
  }

  const { details } = result.eventRequest;

  return (
    <StaffShell
      role="requester"
      crumbs={[
        { label: "My requests", href: "/staff/requester" },
        { label: details.eventName, href: `/staff/requester/${id}` },
        { label: "Request a change" },
      ]}
    >
      <PageHeader
        title="Request a change"
        description="Tick what you want changed and give the new value. Your coordinator decides each one."
      />
      {result.changeRequest === "available" ? (
        <ChangeRequestForm
          eventRequestId={id}
          currentTimes={result.eventTimes ?? []}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {result.changeRequest === "open"
            ? "This event already has a change request waiting on your coordinator."
            : "This event can no longer be changed."}
        </p>
      )}
    </StaffShell>
  );
}
