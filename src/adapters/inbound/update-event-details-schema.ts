import { z } from "zod";

/**
 * What the coordinator's "Edit details" form submits (SPM-49) -- every
 * ordinary detail, as typed. Shape only: trimming, blanks, the name rule and
 * the accessibility list are the domain's (`planOrdinaryEdit`). There is no
 * field here for date, attendance, venue or equipment; those change through a
 * change request (#4).
 */
const text = z.string();

export const updateEventDetailsSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  name: text,
  description: text,
  purpose: text,
  categoryType: text,
  programmeAgenda: text,
  specialArrangements: text,
  accessibilityRequirements: text,
  operationalNotes: text,
});

export type UpdateEventDetailsInput = z.infer<typeof updateEventDetailsSchema>;
