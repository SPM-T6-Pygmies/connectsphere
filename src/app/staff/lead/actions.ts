"use server";

import { revalidatePath } from "next/cache";

import { assignEventCoordinatorSchema } from "@/adapters/inbound/assign-event-coordinator-schema";
import { reassignEventCoordinatorSchema } from "@/adapters/inbound/reassign-event-coordinator-schema";
import {
  buildAssignEventCoordinator,
  buildReassignEventCoordinator,
  getCurrentCoordinatorLead,
  getStaffWorkspaces,
} from "@/composition/container";
import type { AssignmentOperation } from "@/core/use-cases/assign-event-coordinator";

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
    // A Server Action is reachable without its page, so the page's role check
    // does not cover it: only an Event Coordinator Lead may assign.
    if (!(await getStaffWorkspaces()).includes("lead")) {
      return { status: "error" };
    }

    const assignEventCoordinator = await buildAssignEventCoordinator();
    const result = await assignEventCoordinator.execute(parsed.data);

    // Refreshes this detail (including notification-origin details), plus both
    // Operations queue sidebars, in the same Server Action round trip.
    revalidatePath("/staff/lead", "layout");

    return {
      status: "success",
      operation: result.operation,
      assignedCoordinatorUserAccountId: result.assignedCoordinatorUserAccountId,
    };
  } catch {
    return { status: "error" };
  }
}

export type ReassignEventCoordinatorState =
  | { status: "idle" }
  | { status: "success"; assignedCoordinatorUserAccountId: string }
  | { status: "error" };

/** SPM-257: the Lead hands an active event to another coordinator. */
export async function reassignEventCoordinatorAction(
  _previous: ReassignEventCoordinatorState,
  formData: FormData,
): Promise<ReassignEventCoordinatorState> {
  const parsed = reassignEventCoordinatorSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    eventCoordinatorUserAccountId: String(formData.get("eventCoordinatorUserAccountId") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  try {
    // A Server Action is reachable without its page, so it finds the Lead
    // itself -- who is also recorded as having made the change (AC4).
    const lead = await getCurrentCoordinatorLead();
    if (lead === null) {
      return { status: "error" };
    }

    const reassignEventCoordinator = await buildReassignEventCoordinator();
    const result = await reassignEventCoordinator.execute({
      ...parsed.data,
      leadUserAccountId: lead.userAccountId,
    });

    // The event moves between coordinators' cards and My events lists.
    revalidatePath("/staff/lead", "layout");
    revalidatePath("/staff/coordinator", "layout");

    return { status: "success", assignedCoordinatorUserAccountId: result.assignedCoordinatorUserAccountId };
  } catch {
    return { status: "error" };
  }
}
