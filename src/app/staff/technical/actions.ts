"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createEquipmentItemSchema } from "@/adapters/inbound/create-equipment-item-schema";
import { updateEquipmentStockSchema } from "@/adapters/inbound/update-equipment-stock-schema";
import {
  buildCreateEquipmentItem,
  buildUpdateEquipmentStock,
  getStaffWorkspaces,
} from "@/composition/container";
import { DomainError } from "@/core/domain/errors";

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

/** SPM-40 AC2: correct the quantity and location of an existing line. */
export async function updateEquipmentStockAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const parsed = updateEquipmentStockSchema.safeParse(
    submittedValues(formData, ["equipmentItemId", "quantity", "location"]),
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
