"use server";

import { z } from "zod";

import { saveEventRequestDraftSchema } from "@/adapters/inbound/save-event-request-draft-schema";
import { submitEventRequestSchema } from "@/adapters/inbound/submit-event-request-schema";
import {
  actingOrganiser,
  buildDiscardEventRequestDraft,
  buildSaveEventRequestDraft,
  buildSubmitEventRequest,
} from "@/composition/container";
import { DomainError, IncompleteEventRequestError } from "@/core/domain/errors";
import type { SaveEventRequestDraftResult } from "@/core/ports/inbound/save-event-request-draft";
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

const IS_FORM_FIELD = new Set<string>(FORM_FIELDS);

/**
 * A shape refusal, reported only against inputs the Organiser can actually see.
 *
 * Two of the keys the schema checks -- the acting organiser's -- come from the
 * composition root, not the form, and there is no input to put a message
 * against. Passing those through would render the banner over a form with
 * nothing highlighted: the Organiser is told to fix something they cannot
 * find, and the real fault (miswiring, a blank `DEMO_ORGANISER_*`) is hidden
 * behind it. So a refusal with nothing on the form is a fault and reaches the
 * error boundary, the same way a non-domain exception below does.
 */
function refusal(
  fieldErrors: Record<string, string[] | undefined>,
  values: FormValues,
): SubmitRequestState {
  const onTheForm = Object.entries(fieldErrors).filter(([field]) => IS_FORM_FIELD.has(field));

  if (onTheForm.length === 0) {
    throw new Error(
      `Event request submission was refused on ${Object.keys(fieldErrors).join(", ")}, ` +
        "which is not a form field. Check the acting organiser in src/composition/container.ts.",
    );
  }

  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(onTheForm) as Partial<Record<FormField, string[]>>,
    values,
  };
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
  const organiser = actingOrganiser();

  // The composition root names the organiser the way the domain does
  // (`userAccountId`); the command names the same person by their role on the
  // request (`responsibleOrganiserId`). Translating between the two is this
  // adapter's job, and the annotation is what makes it a translation rather
  // than a hope: `safeParse` takes `unknown`, so spreading the wrong shape in
  // type-checks happily and then refuses every submission at runtime.
  const input: z.input<typeof submitEventRequestSchema> = {
    ...values,
    responsibleOrganiserId: organiser.userAccountId,
    clientOrganisationId: organiser.clientOrganisationId,
    // Read from the hidden input the form sets from the browser's own
    // Intl data -- the server has no notion of the Organiser's timezone
    // otherwise. Not a form field either: same treatment as the acting
    // organiser's ids above.
    organiserTimeZone: String(formData.get("organiserTimeZone") ?? ""),
    // Blank for a fresh request, an id when finishing a saved draft (SPM-38).
    // Same treatment as the two above: not something the Organiser types.
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
  };

  const parsed = submitEventRequestSchema.safeParse(input);

  if (!parsed.success) {
    return refusal(z.flattenError(parsed.error).fieldErrors, values);
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

export type SaveDraftState =
  | { status: "idle" }
  | { status: "saved"; result: SaveEventRequestDraftResult }
  | { status: "error"; message: string };

/**
 * SPM-38: the Event Organiser saves their progress without submitting.
 *
 * Same shape as `submitEventRequestAction` -- read the `FormData`, check it,
 * call the use case, translate the outcome -- but a draft never refuses on
 * shape (every field is optional) and the only domain refusal it can hit is
 * a blank event name, so there is no per-field error rendering to do here.
 */
export async function saveEventRequestDraftAction(
  _previous: SaveDraftState,
  formData: FormData,
): Promise<SaveDraftState> {
  const values = valuesFrom(formData);
  const organiser = actingOrganiser();

  const input: z.input<typeof saveEventRequestDraftSchema> = {
    ...values,
    responsibleOrganiserId: organiser.userAccountId,
    clientOrganisationId: organiser.clientOrganisationId,
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
  };

  const parsed = saveEventRequestDraftSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Could not save this draft." };
  }

  try {
    const saveEventRequestDraft = await buildSaveEventRequestDraft();
    const result = await saveEventRequestDraft.execute(parsed.data);

    return { status: "saved", result };
  } catch (error) {
    if (error instanceof IncompleteEventRequestError) {
      return { status: "error", message: "Give the event a name before saving a draft." };
    }

    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }

    throw error;
  }
}

export type DiscardDraftState =
  | { status: "idle" }
  | { status: "discarded" }
  | { status: "error"; message: string };

/**
 * Not in the original brief -- a companion to saving a draft, for an
 * Organiser who starts one they no longer want. Only meaningful once a
 * draft has actually been saved: a request with no id yet has nothing in
 * the store to remove.
 */
export async function discardEventRequestDraftAction(
  _previous: DiscardDraftState,
  formData: FormData,
): Promise<DiscardDraftState> {
  const organiser = actingOrganiser();
  const eventRequestId = String(formData.get("eventRequestId") ?? "");

  if (eventRequestId.length === 0) {
    return { status: "error", message: "There is no draft to discard yet." };
  }

  try {
    const discardEventRequestDraft = await buildDiscardEventRequestDraft();
    await discardEventRequestDraft.execute({
      eventRequestId,
      responsibleOrganiserId: organiser.userAccountId,
      clientOrganisationId: organiser.clientOrganisationId,
    });

    return { status: "discarded" };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }

    throw error;
  }
}
