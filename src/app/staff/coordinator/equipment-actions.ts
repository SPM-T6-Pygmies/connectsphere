"use server";

import { revalidatePath } from "next/cache";

import {
  addEquipmentRequirementSchema,
  editEquipmentRequirementSchema,
  equipmentLineSchema,
} from "@/adapters/inbound/equipment-requirement-schema";
import {
  buildEditEquipmentRequirement,
  buildRecordEquipmentRequirement,
  buildRemoveEquipmentRequirement,
  buildUndoEquipmentRemoval,
  getCurrentCoordinator,
} from "@/composition/container";
import { DomainError, EventNotFoundError } from "@/core/domain/errors";

/**
 * What a coordinator's equipment form is told (SPM-41). A refused add or edit
 * hands back what was typed, because React resets the form after every action,
 * failed ones included.
 */
export type EquipmentFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string; quantity?: string; technicalRequirements?: string };

/**
 * Who is acting comes from `getCurrentCoordinator()` on the server, never from
 * the form -- a posted user id would let any caller change anyone's event. A
 * caller who isn't a coordinator gets the same answer as one who isn't
 * assigned to the event (#91).
 */
async function actingCoordinator(eventId: string) {
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    throw new EventNotFoundError(eventId);
  }
  return coordinator;
}

/**
 * A broken rule is an expected outcome and becomes a message. Anything else is
 * a genuine fault and is allowed to reach the error boundary.
 */
function refusal(error: unknown, typed: { quantity?: string; technicalRequirements?: string } = {}): EquipmentFormState {
  if (error instanceof DomainError) {
    return { status: "error", message: error.message, ...typed };
  }
  throw error;
}

/** The queue, the sidebar and this event page all read what was just changed. */
function refresh() {
  revalidatePath("/staff/coordinator", "layout");
}

/** SPM-41 AC1-AC5: add a line to the event's equipment requirements. */
export async function addEquipmentRequirementAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const typed = {
    quantity: String(formData.get("quantityRequested") ?? ""),
    technicalRequirements: String(formData.get("technicalRequirements") ?? ""),
  };
  const parsed = addEquipmentRequirementSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    equipmentItemId: String(formData.get("equipmentItemId") ?? ""),
    quantityRequested: typed.quantity,
    technicalRequirements: typed.technicalRequirements,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message, ...typed };
  }

  try {
    const coordinator = await actingCoordinator(parsed.data.eventId);
    const recordEquipmentRequirement = await buildRecordEquipmentRequirement();
    await recordEquipmentRequirement.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    return refusal(error, typed);
  }

  refresh();
  return { status: "saved" };
}

/** SPM-41 AC7-AC9: change a line's quantity or technical requirements. */
export async function editEquipmentRequirementAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const typed = {
    quantity: String(formData.get("quantityRequested") ?? ""),
    technicalRequirements: String(formData.get("technicalRequirements") ?? ""),
  };
  const parsed = editEquipmentRequirementSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    equipmentItemId: String(formData.get("equipmentItemId") ?? ""),
    quantityRequested: typed.quantity,
    technicalRequirements: typed.technicalRequirements,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message, ...typed };
  }

  try {
    const coordinator = await actingCoordinator(parsed.data.eventId);
    const editEquipmentRequirement = await buildEditEquipmentRequirement();
    await editEquipmentRequirement.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    return refusal(error, typed);
  }

  refresh();
  return { status: "saved" };
}

/** SPM-41 AC10-AC11: remove a line, or ask Technical Support to release a reserved one. */
export async function removeEquipmentRequirementAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const parsed = equipmentLineSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    equipmentItemId: String(formData.get("equipmentItemId") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const coordinator = await actingCoordinator(parsed.data.eventId);
    const removeEquipmentRequirement = await buildRemoveEquipmentRequirement();
    await removeEquipmentRequirement.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    return refusal(error);
  }

  refresh();
  return { status: "saved" };
}

/** SPM-41 AC17: take back a removal Technical Support have not yet acted on. */
export async function undoEquipmentRemovalAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const parsed = equipmentLineSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    equipmentItemId: String(formData.get("equipmentItemId") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const coordinator = await actingCoordinator(parsed.data.eventId);
    const undoEquipmentRemoval = await buildUndoEquipmentRemoval();
    await undoEquipmentRemoval.execute({ ...parsed.data, ...coordinator });
  } catch (error) {
    return refusal(error);
  }

  refresh();
  return { status: "saved" };
}
