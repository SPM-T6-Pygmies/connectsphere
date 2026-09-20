"use server";

import { revalidatePath } from "next/cache";

import { reassignEventOrganiserSchema } from "@/adapters/inbound/reassign-event-organiser-schema";
import { buildChangeEventOrganiser, getStaffWorkspaces } from "@/composition/container";

/**
 * SPM-39 AC5, via a plain form post rather than `useActionState`: there is no
 * per-field input to validate or echo back, just an id and a new owner, so
 * the richer form-state pattern in `requester/new/actions.ts` would be
 * ceremony this action does not need.
 *
 * #101 names the Event Operations Manager as the only role with
 * assign/reassign authority -- not the Event Organiser. A Server Action is
 * reachable without its page, so a page-level role check would not cover it
 * (see `assignEventCoordinatorAction`'s identical guard): only an Event
 * Operations Manager may reassign.
 */
export async function reassignEventOrganiserAction(formData: FormData): Promise<void> {
  const parsed = reassignEventOrganiserSchema.safeParse({
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
    newResponsibleOrganiserId: String(formData.get("newResponsibleOrganiserId") ?? ""),
  });

  if (!parsed.success) {
    return;
  }

  if (!(await getStaffWorkspaces()).includes("ops")) {
    return;
  }

  const changeEventOrganiser = await buildChangeEventOrganiser();
  await changeEventOrganiser.execute(parsed.data);

  revalidatePath("/staff/requester/organisation");
}
