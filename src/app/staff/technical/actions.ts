"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createEquipmentItemSchema } from "@/adapters/inbound/create-equipment-item-schema";
import {
  equipmentLineDecisionSchema,
  markEquipmentLineUnfulfilledSchema,
} from "@/adapters/inbound/equipment-line-decision-schema";
import { updateEquipmentStockSchema } from "@/adapters/inbound/update-equipment-stock-schema";
import {
  buildCreateEquipmentItem,
  buildMarkEquipmentLineUnfulfilled,
  buildReserveEquipmentLine,
  buildUpdateEquipmentStock,
  getCurrentTechnicalSupport,
  getStaffWorkspaces,
} from "@/composition/container";
import {
  DomainError,
  EquipmentLineNotAwaitingDecisionError,
  NotEnoughEquipmentAvailableError,
} from "@/core/domain/errors";

export type EquipmentFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** What was submitted, so a rejected form keeps what the person typed. */
      values?: Record<string, string>;
    };

const NOT_ALLOWED: EquipmentFormState = {
  status: "error",
  message: "Only Technical Support Staff can change the equipment catalogue.",
};

function submittedValues(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? "")]));
}

/** SPM-40 AC1: add a line to the equipment catalogue. */
export async function createEquipmentItemAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const values = submittedValues(formData, ["type", "description", "quantity", "location"]);
  const parsed = createEquipmentItemSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  // A Server Action is reachable without its page, so the shell's role check
  // does not cover it: only Technical Support Staff may change the catalogue.
  if (!(await getStaffWorkspaces()).includes("technical")) {
    return NOT_ALLOWED;
  }

  try {
    const createEquipmentItem = await buildCreateEquipmentItem();
    const created = await createEquipmentItem.execute({
      ...parsed.data,
      description: parsed.data.description,
    });

    revalidatePath("/staff/technical", "layout");
    return { status: "success", message: `${created.type} added to the catalogue.` };
  } catch (error) {
    // A broken rule is an expected outcome and becomes a message. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, values };
    }
    throw error;
  }
}

/**
 * SPM-40 AC2, SPM-17 AC1: correct an existing line's quantity, location and
 * units out of service. SPM-274 AC7: saved even when that leaves too few in
 * service; the card then shows the days that are short.
 */
export async function updateEquipmentStockAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const parsed = updateEquipmentStockSchema.safeParse(
    submittedValues(formData, ["equipmentItemId", "quantity", "location", "outOfService"]),
  );

  if (!parsed.success) {
    return {
      status: "error",
      message: Object.values(z.flattenError(parsed.error).fieldErrors).flat()[0] ?? "Check the values.",
    };
  }

  if (!(await getStaffWorkspaces()).includes("technical")) {
    return NOT_ALLOWED;
  }

  try {
    const updateEquipmentStock = await buildUpdateEquipmentStock();
    await updateEquipmentStock.execute(parsed.data);

    revalidatePath("/staff/technical", "layout");
    return { status: "success", message: "Saved." };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

const NOT_TECHNICAL_SUPPORT: EquipmentFormState = {
  status: "error",
  message: "Only Technical Support Staff can reserve equipment.",
};

/**
 * Runs one SPM-274 decision as the signed-in Technical Support Staff member,
 * turning a broken rule into the line's message. A refusal because the line
 * or what is free changed since the page was read (AC6) refreshes the page
 * too, so it shows where things now stand.
 */
async function decideOnLine(
  decide: (userAccountId: string) => Promise<{ readonly equipmentType: string; readonly state: string }>,
): Promise<EquipmentFormState> {
  // A Server Action is reachable without its page, so the page's own check does not cover it.
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    return NOT_TECHNICAL_SUPPORT;
  }

  try {
    const decided = await decide(technicalSupport.userAccountId);
    revalidatePath("/staff/technical", "layout");
    return { status: "success", message: `${decided.equipmentType}: ${decided.state.toLowerCase()}.` };
  } catch (error) {
    if (error instanceof DomainError) {
      if (error instanceof NotEnoughEquipmentAvailableError || error instanceof EquipmentLineNotAwaitingDecisionError) {
        revalidatePath("/staff/technical", "layout");
      }
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

/** SPM-274 AC1: reserve a line's full quantity. */
export async function reserveEquipmentLineAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const parsed = equipmentLineDecisionSchema.safeParse(submittedValues(formData, ["eventId", "equipmentItemId"]));
  if (!parsed.success) {
    return { status: "error", message: "Reload the page and try again." };
  }

  return decideOnLine(async (userAccountId) =>
    (await buildReserveEquipmentLine()).execute({ ...parsed.data, userAccountId }),
  );
}

/** SPM-274 AC3: mark a line unfulfilled, with a comment saying why. */
export async function markEquipmentLineUnfulfilledAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const values = submittedValues(formData, ["eventId", "equipmentItemId", "comment"]);
  const parsed = markEquipmentLineUnfulfilledSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "Reload the page and try again.", values };
  }

  const result = await decideOnLine(async (userAccountId) =>
    (await buildMarkEquipmentLineUnfulfilled()).execute({ ...parsed.data, userAccountId }),
  );
  return result.status === "error" ? { ...result, values } : result;
}
