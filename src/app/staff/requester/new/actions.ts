"use server";

import { z } from "zod";

import { submitEventRequestSchema } from "@/adapters/inbound/submit-event-request-schema";
import { actingOrganiser, buildSubmitEventRequest } from "@/composition/container";
import { DomainError, IncompleteEventRequestError } from "@/core/domain/errors";
import type { SubmitEventRequestResult } from "@/core/ports/inbound/submit-event-request";

import {
  FIELD_LABELS,
  FORM_FIELDS,
  type FormField,
  type FormValues,
} from "./form-fields";

export type SubmitRequestState =
  | { status: "idle" }
  | { status: "submitted"; result: SubmitEventRequestResult }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<FormField, string[]>>;
      /** Echoed back so a refused submission does not make the organiser retype. */
      values: FormValues;
    };

function valuesFrom(formData: FormData): FormValues {
  return Object.fromEntries(
    FORM_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as FormValues;
}

/** "Preferred time is required." -- one message per field, against its own input. */
function missingFieldErrors(missing: readonly string[]): Partial<Record<FormField, string[]>> {
  const errors: Partial<Record<FormField, string[]>> = {};

  for (const field of missing) {
    const label = FIELD_LABELS[field as FormField] ?? field;
    errors[field as FormField] = [`${label} is required to submit this request.`];
  }

  return errors;
}

/**
 * SPM-31: the Event Organiser submits their requirements.
 *
 * Four responsibilities, all of them translation: read the `FormData`, check
 * its shape, call the use case, turn the outcome into something renderable.
 * Which fields are mandatory is not decided here -- the core decides, and this
 * only puts each refusal against the right input.
 */
export async function submitEventRequestAction(
  _previous: SubmitRequestState,
  formData: FormData,
): Promise<SubmitRequestState> {
  const values = valuesFrom(formData);

  const parsed = submitEventRequestSchema.safeParse({ ...values, ...actingOrganiser() });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Partial<Record<FormField, string[]>>,
      values,
    };
  }

  try {
    const submitEventRequest = await buildSubmitEventRequest();
    const result = await submitEventRequest.execute(parsed.data);

    return { status: "submitted", result };
  } catch (error) {
    // An incomplete request is an expected outcome and becomes a message
    // against each missing field. Any other domain refusal becomes a message
    // on its own. Anything else is a genuine fault and reaches the error
    // boundary rather than being dressed up as a validation failure.
    if (error instanceof IncompleteEventRequestError) {
      return {
        status: "error",
        message: "This request is missing some required information.",
        fieldErrors: missingFieldErrors(error.missing),
        values,
      };
    }

    if (error instanceof DomainError) {
      return { status: "error", message: error.message, values };
    }

    throw error;
  }
}
