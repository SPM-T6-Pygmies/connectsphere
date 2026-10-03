import { z } from "zod";

import { parseOptionList, unknownOptions } from "@/core/domain/venue-options";

/**
 * A blank-or-null text field whose comma-separated values must all come from
 * `allowed` -- the event request's fields the form offers as a fixed list.
 * `max` caps how many may be chosen: 1 for a pick-one field such as the room layout.
 */
export function optionalOptions(allowed: readonly string[], max = allowed.length) {
  return z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine((value) => unknownOptions(value, allowed).length === 0, {
      message: `Choose from ${allowed.join(", ")}.`,
    })
    .refine((value) => parseOptionList(value).length <= max, {
      message: max === 1 ? "Choose one." : `Choose at most ${max}.`,
    });
}
