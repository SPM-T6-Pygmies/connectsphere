import { forbidden, notFound } from "next/navigation";

import { buildViewOrganiserEventRequest, getCurrentOrganiser } from "@/composition/container";

import { SubmittedRequestDetail } from "../submitted-request-detail";

export default async function Page({ params }: PageProps<"/staff/requester/[id]">) {
  const { id } = await params;
  const organiser = await getCurrentOrganiser();
  if (organiser === null) {
    forbidden();
  }

  const viewOrganiserEventRequest = await buildViewOrganiserEventRequest();
  const result = await viewOrganiserEventRequest.execute({ id, ...organiser });

  if (result === null) {
    notFound();
  }

  return (
    <SubmittedRequestDetail
      eventRequest={result.eventRequest}
      clarificationThread={result.clarificationThread}
      canDiscuss={result.canDiscuss}
      assignedCoordinatorName={result.assignedCoordinatorName}
      organiserName={organiser.name}
    />
  );
}
