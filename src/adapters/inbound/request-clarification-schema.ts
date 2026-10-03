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

/**
 * What a question's Resolve button submits (SPM-33 AC6).
 *
 * Names the question, not just the request: resolving is per thread, because a
 * Coordinator can have two outstanding at once and answering one of them is
 * not the same as no longer waiting.
 */
export const resolveClarificationThreadSchema = z.object({
  id: z.string().trim().min(1, "The event request is missing."),
  clarificationMessageId: z.string().trim().min(1, "The question is missing."),
});

export type ResolveClarificationThreadInput = z.infer<typeof resolveClarificationThreadSchema>;
