"use server";

import { revalidatePath } from "next/cache";

import { postClarificationMessageSchema } from "@/adapters/inbound/post-clarification-message-schema";
import { buildPostClarificationMessage, getCurrentOrganiser } from "@/composition/container";
import { DomainError, EventRequestNotFoundError } from "@/core/domain/errors";

export type PostClarificationMessageState =
  | { status: "idle" }
  | { status: "error"; message: string };

/**
 * SPM-33 AC4-AC5: the responsible Event Organiser answers on their request's
 * clarification thread.
 *
 * Who is replying comes from `getCurrentOrganiser()` on the server, never from
 * the form. The identity check here is not a duplicate of the page's: a Server
 * Action is reachable without its page, so this is the only check that covers
 * this entry point -- the same reasoning as the other requester actions.
 *
 * Nothing about the request itself changes. Posting is an append, which is
 * what keeps #102 honoured: the Organiser still cannot edit what they
 * submitted, and answering a question about it was never an edit.
 */
export async function postClarificationMessageAction(
  _previous: PostClarificationMessageState,
  formData: FormData,
): Promise<PostClarificationMessageState> {
  const parsed = postClarificationMessageSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    body: String(formData.get("body") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: "That request could not be identified." };
  }

  try {
    // A caller who isn't an Organiser gets the same answer as one replying to
    // someone else's request (#91), as the requester pages do.
    const organiser = await getCurrentOrganiser();
    if (organiser === null) {
      throw new EventRequestNotFoundError(parsed.data.id);
    }

    const postClarificationMessage = await buildPostClarificationMessage();
    await postClarificationMessage.execute({
      ...parsed.data,
      userAccountId: organiser.userAccountId,
      organisationId: organiser.clientOrganisationId,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/staff/requester", "layout");

  return { status: "idle" };
}
