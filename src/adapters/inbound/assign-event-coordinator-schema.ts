import { z } from "zod";

/** The two identifiers submitted by the Operations assignment form. */
export const assignEventCoordinatorSchema = z.object({
  eventRequestId: z.string().trim().min(1, "The event request is missing."),
  eventCoordinatorUserAccountId: z
    .string()
    .trim()
    .min(1, "Select an Event Coordinator."),
});

export type AssignEventCoordinatorInput = z.infer<typeof assignEventCoordinatorSchema>;
