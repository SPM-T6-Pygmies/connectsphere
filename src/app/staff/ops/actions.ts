"use server";

import { revalidatePath } from "next/cache";

import { assignEventCoordinatorSchema } from "@/adapters/inbound/assign-event-coordinator-schema";
import { buildAssignEventCoordinator } from "@/composition/container";

export type AssignmentOperation = "assigned" | "reassigned";

export type AssignEventCoordinatorState =
  | { status: "idle" }
  | {
      status: "success";
      operation: AssignmentOperation;
      assignedCoordinatorUserAccountId: string;
    }
  | { status: "error" };

export async function assignEventCoordinatorAction(
  _previous: AssignEventCoordinatorState,
  formData: FormData,
): Promise<AssignEventCoordinatorState> {
  const operation: AssignmentOperation =
    formData.get("assignmentOperation") === "reassigned" ? "reassigned" : "assigned";
  const parsed = assignEventCoordinatorSchema.safeParse({
    eventRequestId: String(formData.get("eventRequestId") ?? ""),
    eventCoordinatorUserAccountId: String(
      formData.get("eventCoordinatorUserAccountId") ?? "",
    ),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  try {
    const assignEventCoordinator = await buildAssignEventCoordinator();
    const result = await assignEventCoordinator.execute(parsed.data);

    // Refreshes this detail (including notification-origin details), plus both
    // Operations queue sidebars, in the same Server Action round trip.
    revalidatePath("/staff/ops", "layout");

    return {
      status: "success",
      operation,
      assignedCoordinatorUserAccountId: result.assignedCoordinatorUserAccountId,
    };
  } catch {
    return { status: "error" };
  }
}
