import { z } from "zod";

import { unknownOptions } from "@/core/domain/venue-options";

/**
 * A blank-or-null text field whose comma-separated values must all come from
 * `allowed` -- the event request's facilities-style fields, which the form
 * offers as a fixed list. A single-value field (the room layout) is the same
 * shape with one entry.
 */
export function optionalOptions(allowed: readonly string[]) {
  return z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine((value) => unknownOptions(value, allowed).length === 0, {
      message: `Choose from ${allowed.join(", ")}.`,
    });
}
