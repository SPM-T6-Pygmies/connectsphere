import { z } from "zod";

import { CHANGE_REQUEST_FIELDS } from "@/core/domain/change-request";

const decision = z.discriminatedUnion("outcome", [
  z.object({ field: z.enum(CHANGE_REQUEST_FIELDS), outcome: z.literal("Accepted") }),
  z.object({ field: z.enum(CHANGE_REQUEST_FIELDS), outcome: z.literal("Declined"), reason: z.string() }),
]);

/**
 * What the decision form submits (SPM-100): the event and request ids, and one
 * decision per field as a JSON `decisions` value.
 *
 * Shape only. Whether every field is decided and every decline has a reason
 * are the core's rules (`decideChangeRequest`).
 */
export const decideChangeRequestSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  changeRequestId: z.string().trim().min(1, "The change request is missing."),
  decisions: z.string().transform((raw, context) => {
    try {
      return z.array(decision).parse(JSON.parse(raw));
    } catch {
      context.addIssue({ code: "custom", message: "The decisions could not be read." });
      return z.NEVER;
    }
  }),
});

export type DecideChangeRequestInput = z.infer<typeof decideChangeRequestSchema>;
