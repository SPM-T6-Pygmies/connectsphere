"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createVenueSchema,
  updateVenueSchema,
  venueFieldErrors,
  venueFormValues,
} from "@/adapters/inbound/venue-schema";
import {
  buildCreateVenue,
  buildUpdateVenue,
  getVenueMaintenanceRoles,
} from "@/composition/container";
import { DomainError, InvalidVenueError } from "@/core/domain/errors";

export type VenueFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string;
      /** Keyed by form field (`layouts.0.capacity` for a layout row); empty when the error is not about one. */
      fieldErrors: Record<string, string>;
    };

const FLAGGED = "Fix the highlighted fields.";

/** A refusal from the domain, flagged on its field when it names one. */
function refusal(error: DomainError): VenueFormState {
  return {
    status: "error",
    message: error.message,
    fieldErrors:
      error instanceof InvalidVenueError && error.field !== null
        ? { [error.field]: error.message }
        : {},
  };
}

/** SPM-146: create a venue, then open it. */
export async function createVenueAction(
  _previous: VenueFormState,
  formData: FormData,
): Promise<VenueFormState> {
  const parsed = createVenueSchema.safeParse(venueFormValues(formData));
  if (!parsed.success) {
    return { status: "error", message: FLAGGED, fieldErrors: venueFieldErrors(parsed.error) };
  }

  let venueId: string;
  try {
    // A Server Action is reachable without its page, so the page's role check
    // does not cover it. The use case refuses anyone but Venue Staff, and the
    // database checks again.
    const createVenue = await buildCreateVenue();
    const { venue } = await createVenue.execute({
      roles: await getVenueMaintenanceRoles(),
      ...parsed.data,
    });
    venueId = venue.id;
  } catch (error) {
    if (error instanceof DomainError) {
      return refusal(error);
    }
    throw error;
  }

  revalidatePath("/staff/venue/catalogue");
  redirect(`/staff/venue/catalogue/${venueId}`);
}

/** SPM-147: update a venue in place. */
export async function updateVenueAction(
  _previous: VenueFormState,
  formData: FormData,
): Promise<VenueFormState> {
  const parsed = updateVenueSchema.safeParse(venueFormValues(formData));
  if (!parsed.success) {
    return { status: "error", message: FLAGGED, fieldErrors: venueFieldErrors(parsed.error) };
  }

  try {
    const updateVenue = await buildUpdateVenue();
    await updateVenue.execute({
      roles: await getVenueMaintenanceRoles(),
      ...parsed.data,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return refusal(error);
    }
    throw error;
  }

  revalidatePath("/staff/venue/catalogue", "layout");
  return { status: "saved" };
}
