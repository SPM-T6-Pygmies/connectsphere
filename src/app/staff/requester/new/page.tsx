import { actingOrganiser, buildViewEventRequest } from "@/composition/container";

import { StaffShell } from "../../staff-shell";
import type { FormValues } from "./form-fields";
import { NewRequestForm } from "./new-request-form";

export const metadata = { title: "New event request | ConnectSphere" };

/**
 * A saved draft, read back from wherever `SaveEventRequestDraft` put it
 * (SPM-38) -- so "continue editing" always resumes the request the
 * Organiser actually saved, id included, rather than raising a new one.
 *
 * `undefined` when there is no such draft, it is not this Organiser's to
 * edit, or it has already moved past Draft -- `ViewEventRequestUseCase`
 * already treats "not visible" the same as "not found" (#91), and a
 * non-draft has nothing here to resume.
 */
async function draftFor(
  id: string,
): Promise<{ eventRequestId: string; values: Partial<FormValues> } | undefined> {
  const organiser = actingOrganiser();
  const viewEventRequest = await buildViewEventRequest();
  const result = await viewEventRequest.execute({ id, ...organiser });

  if (result === null || result.eventRequest.status !== "Draft") {
    return undefined;
  }

  const { details } = result.eventRequest;
  return {
    eventRequestId: result.eventRequest.id,
    values: {
      eventName: details.eventName,
      description: details.description ?? "",
      purpose: details.purpose ?? "",
      preferredDate: details.preferredDate ?? "",
      expectedAttendance: details.expectedAttendance?.toString() ?? "",
      venueRequirements: details.venueRequirements ?? "",
      roomLayoutPreferences: details.roomLayoutPreferences ?? "",
      accessibilityNeeds: details.accessibilityNeeds ?? "",
      equipmentRequirements: details.equipmentRequirements ?? "",
      registrationRequirements: details.registrationRequirements ?? "",
      generalProgramme: details.generalProgramme ?? "",
      otherSpecialArrangements: details.otherSpecialArrangements ?? "",
    },
  };
}

export default async function NewRequestPage({
  searchParams,
}: PageProps<"/staff/requester/new">) {
  const { draft } = await searchParams;
  const loaded = typeof draft === "string" ? await draftFor(draft) : undefined;

  return (
    <StaffShell
      role="requester"
      crumbs={[{ label: "My requests", href: "/staff/requester" }, { label: "New request" }]}
    >
      <NewRequestForm
        initialValues={loaded?.values}
        initialEventRequestId={loaded?.eventRequestId}
      />
    </StaffShell>
  );
}
