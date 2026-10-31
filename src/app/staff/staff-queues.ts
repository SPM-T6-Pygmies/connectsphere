import { cache } from "react";

import {
  buildListEquipmentQueue,
  buildReviewBookingRequests,
  buildViewArchivedEventRequests,
  buildViewAssignedEventRequests,
  buildViewAssignedEvents,
  buildViewMyEventRequests,
} from "@/composition/container";
import type { EquipmentQueue } from "@/core/domain/equipment-review";
import type { BookingReviewSection } from "@/core/use-cases/review-booking-requests";

/**
 * The lists a staff screen shows both in its page and in `StaffShell`'s queue
 * pane, read once per request however many of them ask. Keyed on plain ids,
 * since `cache()` compares its arguments by identity.
 */
export const myEventRequests = cache(async (userAccountId: string, clientOrganisationId: string) =>
  (await buildViewMyEventRequests()).execute({ userAccountId, clientOrganisationId }),
);

export const assignedEventRequests = cache(async (userAccountId: string) =>
  (await buildViewAssignedEventRequests()).execute({ userAccountId }),
);

export const archivedEventRequests = cache(async (userAccountId: string) =>
  (await buildViewArchivedEventRequests()).execute({ userAccountId }),
);

export const assignedEvents = cache(async (userAccountId: string) =>
  (await buildViewAssignedEvents()).execute({ userAccountId }),
);

export const bookingsForReview = cache(async (userAccountId: string, section: BookingReviewSection) =>
  (await buildReviewBookingRequests()).list(userAccountId, section),
);

export const equipmentQueue = cache(async (userAccountId: string, queue: EquipmentQueue) =>
  (await buildListEquipmentQueue()).execute({ userAccountId, queue }),
);
