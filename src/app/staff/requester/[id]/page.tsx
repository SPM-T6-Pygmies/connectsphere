import { notFound } from "next/navigation";

import { actingOrganiser, buildViewEventRequest } from "@/composition/container";

import { SubmittedRequestDetail } from "../submitted-request-detail";

export default async function Page({ params }: PageProps<"/staff/requester/[id]">) {
  const { id } = await params;
  const organiser = actingOrganiser();
  const viewEventRequest = await buildViewEventRequest();
  const result = await viewEventRequest.execute({ id, ...organiser });

  if (result === null) {
    notFound();
  }

  return <SubmittedRequestDetail eventRequest={result.eventRequest} />;
}
