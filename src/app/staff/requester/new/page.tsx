import { eventById } from "@/lib/wireframe";

import { StaffShell } from "../../staff-shell";
import type { FormValues } from "./form-fields";
import { NewRequestForm } from "./new-request-form";

export const metadata = { title: "New event request | ConnectSphere" };

/**
 * Prefill from a wireframe draft, so the form can be walked with realistic
 * content.
 *
 * Draft-save is its own card (SPM-38) and depends on this one, so there are no
 * stored drafts yet -- submitting a prefilled form raises a new request rather
 * than updating a draft. SPM-38 is where that becomes an update.
 */
function draftValues(id: string): Partial<FormValues> | undefined {
  const request = eventById(id)?.request;
  if (request === undefined) {
    return undefined;
  }

  return {
    eventName: request.eventName,
    description: request.description ?? "",
    purpose: request.purpose ?? "",
    preferredDate: request.preferredDate ?? "",
    preferredTime: request.preferredTime ?? "",
    expectedAttendance: request.expectedAttendance?.toString() ?? "",
    venueRequirements: request.venueRequirements ?? "",
    roomLayoutPreferences: request.roomLayoutPreferences ?? "",
    accessibilityNeeds: request.accessibilityNeeds ?? "",
    equipmentRequirements: request.equipmentRequirements ?? "",
    registrationRequirements: request.registrationRequirements ?? "",
    generalProgramme: request.generalProgramme ?? "",
    otherSpecialArrangements: request.otherSpecialArrangements ?? "",
  };
}

export default async function NewRequestPage({
  searchParams,
}: PageProps<"/staff/requester/new">) {
  const { draft } = await searchParams;
  const initialValues = typeof draft === "string" ? draftValues(draft) : undefined;

  return (
    <StaffShell
      role="requester"
      crumbs={[{ label: "My requests", href: "/staff/requester" }, { label: "New request" }]}
    >
      <NewRequestForm initialValues={initialValues} />
    </StaffShell>
  );
}
