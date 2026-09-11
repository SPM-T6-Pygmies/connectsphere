"use server";

import { revalidatePath } from "next/cache";

import { buildChangeEventOrganiser } from "@/composition/container";

/**
 * SPM-39 AC5: the responsible Organiser hands a request to a colleague. No
 * confirmation state is threaded back to the page (unlike the submit-request
 * flow) -- the reassignment either lands, and the list re-renders with the
 * outgoing Organiser's Edit badge gone and the incoming one's Organiser now
 * seeing it, or it throws to the error boundary, same as any other fault in
 * this demo-only flow.
 */
export async function reassignEventOrganiser(formData: FormData): Promise<void> {
  const eventRequestId = String(formData.get("eventRequestId") ?? "");
  const newResponsibleOrganiserId = String(formData.get("newResponsibleOrganiserId") ?? "");

  const changeEventOrganiser = await buildChangeEventOrganiser();
  await changeEventOrganiser.execute({ eventRequestId, newResponsibleOrganiserId });

  revalidatePath("/staff/requester/organisation");
}
