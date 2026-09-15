import { z } from "zod";

/**
 * The reassign control's shape: which request, and who should now own it.
 *
 * The new Organiser's id must be present once trimmed -- an unchosen dropdown
 * posts an empty value. The request id is taken as it comes, the same as the
 * action did by hand: an id that is not one of ours is the use case's
 * not-found, not the transport's refusal.
 */
export const reassignEventOrganiserSchema = z.object({
  eventRequestId: z.string(),
  newResponsibleOrganiserId: z.string().trim().min(1),
});

export type ReassignEventOrganiserInput = z.infer<typeof reassignEventOrganiserSchema>;
