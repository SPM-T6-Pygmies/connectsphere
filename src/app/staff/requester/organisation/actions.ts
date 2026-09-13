"use server";

import { revalidatePath } from "next/cache";

import { buildChangeEventOrganiser } from "@/composition/container";

/**
 * SPM-39 AC5, via a plain form post rather than `useActionState`: there is no
 * per-field input to validate or echo back, just an id and a new owner, so
 * the richer form-state pattern in `requester/new/actions.ts` would be
 * ceremony this action does not need.
 *
 * Deliberately does not check who is calling -- see
 * `ChangeEventOrganiserUseCase`'s own doc comment. No source has settled that
 * authority model yet (SPM-114); this action inherits the use case's stance
 * rather than inventing one here.
 */
export async function reassignEventOrganiserAction(formData: FormData): Promise<void> {
  const eventRequestId = String(formData.get("eventRequestId") ?? "");
  const newResponsibleOrganiserId = String(formData.get("newResponsibleOrganiserId") ?? "").trim();

  if (newResponsibleOrganiserId.length === 0) {
    return;
  }

  const changeEventOrganiser = await buildChangeEventOrganiser();
  await changeEventOrganiser.execute({ eventRequestId, newResponsibleOrganiserId });

  revalidatePath("/staff/requester/organisation");
}
