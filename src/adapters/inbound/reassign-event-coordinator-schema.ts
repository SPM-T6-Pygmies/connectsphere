import { z } from "zod";

/** The two identifiers submitted by the Lead's event reassignment form (SPM-257). */
export const reassignEventCoordinatorSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  eventCoordinatorUserAccountId: z
    .string()
    .trim()
    .min(1, "Select an Event Coordinator."),
});
