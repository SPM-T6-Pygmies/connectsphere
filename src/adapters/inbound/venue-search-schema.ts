import { z } from "zod";

import { parseOptionList } from "@/core/domain/venue-options";

/**
 * The venue search's query string (SPM-44) -- and only its shape.
 *
 * Every filter is optional, so a blank or missing one becomes null (or an empty
 * list). Whether a date needs times, or a time is on the 15-minute grid, is
 * `defineVenueSearch`'s call (SPM-322). Facilities and accessibility arrive as
 * one comma-separated value each, as `OptionCheckboxes` posts them; the start
 * and end as `HH:MM`, as `TimePicker` posts them.
 */
const param = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    const text = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
    return text.length === 0 ? null : text;
  });

export const venueSearchSchema = z.object({
  layout: param,
  attendance: param.pipe(
    z
      .string()
      .regex(/^\d+$/, "Enter attendance as a whole number.")
      .transform(Number)
      .nullable(),
  ),
  facilities: param.transform(parseOptionList),
  accessibility: param.transform(parseOptionList),
  date: param,
  start: param,
  end: param,
});

export type VenueSearchParams = z.input<typeof venueSearchSchema>;
