import { z } from "zod";

/**
 * The discard control's shape: the id of the draft being discarded, and
 * nothing else.
 *
 * Presence only, and not trimmed -- exactly the check the action used to make
 * by hand. Whether that id is a draft this Organiser may discard is the use
 * case's question (`DraftNotEditableError`), not the transport's.
 */
export const discardEventRequestDraftSchema = z.object({
  eventRequestId: z.string().min(1, "There is no draft to discard yet."),
});

export type DiscardEventRequestDraftInput = z.infer<typeof discardEventRequestDraftSchema>;
