"use server";

import { revalidatePath } from "next/cache";

import {
  liftVenueUnavailabilitySchema,
  recordVenueUnavailabilitySchema,
} from "@/adapters/inbound/venue-unavailability-schema";
import {
  buildLiftVenueUnavailability,
  buildRecordVenueUnavailability,
  getCurrentVenueStaff,
  getVenueMaintenanceRoles,
} from "@/composition/container";
import { DomainError, VenueUnavailabilityNotPermittedError } from "@/core/domain/errors";
import type { VenueUnavailabilityEntry } from "@/core/domain/venue-unavailability";
import type { AffectedBooking } from "@/core/ports/outbound/venue-unavailability-repository";

export type RecordUnavailabilityState =
  | { status: "idle" }
  | {
      status: "saved";
      entry: VenueUnavailabilityEntry;
      /** The bookings the block sits over, left as they were. Empty when none. */
      affectedBookings: readonly AffectedBooking[];
    }
  | { status: "error"; message: string };

export type LiftUnavailabilityState =
  | { status: "idle" }
  | { status: "lifted" }
  | { status: "error"; message: string };

/** SPM-21: Venue Staff block a venue for a date range and some slots. */
export async function recordUnavailabilityAction(
  _previous: RecordUnavailabilityState,
  formData: FormData,
): Promise<RecordUnavailabilityState> {
  const parsed = recordVenueUnavailabilitySchema.safeParse({
    venueId: String(formData.get("venueId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    slots: String(formData.get("slots") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  try {
    // A Server Action is reachable without its page, so the page's role check
    // does not cover it. The use case refuses anyone but Venue Staff, and the
    // database checks again.
    const staff = await getCurrentVenueStaff();
    if (staff === null) {
      throw new VenueUnavailabilityNotPermittedError();
    }

    const recordVenueUnavailability = await buildRecordVenueUnavailability();
    const { entry, affectedBookings } = await recordVenueUnavailability.execute({
      roles: await getVenueMaintenanceRoles(),
      userAccountId: staff.userAccountId,
      ...parsed.data,
    });

    revalidatePath("/staff/venue/unavailability");
    return { status: "saved", entry, affectedBookings };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

/** SPM-21: lift a block early. It stays on record as Lifted. */
export async function liftUnavailabilityAction(
  _previous: LiftUnavailabilityState,
  formData: FormData,
): Promise<LiftUnavailabilityState> {
  const parsed = liftVenueUnavailabilitySchema.safeParse({
    unavailabilityId: String(formData.get("unavailabilityId") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  try {
    const staff = await getCurrentVenueStaff();
    if (staff === null) {
      throw new VenueUnavailabilityNotPermittedError();
    }

    const liftVenueUnavailability = await buildLiftVenueUnavailability();
    await liftVenueUnavailability.execute({
      roles: await getVenueMaintenanceRoles(),
      userAccountId: staff.userAccountId,
      unavailabilityId: parsed.data.unavailabilityId,
    });

    revalidatePath("/staff/venue/unavailability");
    return { status: "lifted" };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
