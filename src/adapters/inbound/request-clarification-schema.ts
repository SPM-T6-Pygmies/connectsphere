import { z } from "zod";

/**
 * What the coordinator's clarification form submits (SPM-33).
 *
 * Shape only. Whether the message says anything is a business rule, and it
 * stays in the domain (`returnEventRequest`) so the form and every other
 * caller get the same answer -- the same split `decideEventRequestSchema`
 * draws over a rejection's reason.
 */
export const requestClarificationSchema = z.object({
  id: z.string().trim().min(1, "The event request is missing."),
  message: z.string(),
});

export type RequestClarificationInput = z.infer<typeof requestClarificationSchema>;

/** What the coordinator's Resolve button submits (SPM-33 AC6): the request, and nothing else. */
export const resolveClarificationSchema = z.object({
  id: z.string().trim().min(1, "The event request is missing."),
});

export type ResolveClarificationInput = z.infer<typeof resolveClarificationSchema>;
