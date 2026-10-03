import type { Brand } from "./brand";
import { RoomLayoutRequiredError, UnsupportedRoomLayoutError } from "./errors";
import type { Venue, VenueId } from "./venue";

export type BookingId = Brand<string, "BookingId">;

/** `booking_status_chk` in the initial schema. */
export type BookingStatus =
  | "Requested"
  | "Tentative Hold"
  | "Confirmed"
  | "Rejected"
  | "Released"
  | "Cancelled";

/**
 * A venue booking as far as SPM-104 needs it. The full request -- slots,
 * clash blocking, Venue Staff's decision -- is SPM-46 (PR #75); this carries
 * only what the layout rules read and write.
 */
export interface Booking {
  readonly id: BookingId;
  readonly eventId: string;
  readonly venueId: VenueId;
  /** One of the venue's supported layouts, by name -- never free text. */
  readonly roomLayout: string;
  readonly status: BookingStatus;
}

/**
 * SPM-104: the layout a booking assumes, as a reference to one the venue
 * supports. Always required: a booking with no layout cannot be checked for
 * capacity. Matching is exact, so free text that only resembles a layout is
 * refused.
 */
export function chooseRoomLayout(venue: Venue, requested: string | null): string {
  const layout = requested?.trim() ?? "";
  if (layout.length === 0) {
    throw new RoomLayoutRequiredError();
  }
  if (!venue.layouts.some((supported) => supported.name === layout)) {
    throw new UnsupportedRoomLayoutError(layout);
  }
  return layout;
}

/**
 * What comparing an event's attendance with a booking's layout found. It is a
 * report, not a ruling: whether exceeding capacity blocks a booking or only
 * warns is SPM-107, still a customer question.
 */
export interface LayoutCapacityCheck {
  readonly layout: string;
  /** The figure for this layout at this venue -- never the venue-wide one. */
  readonly capacity: number;
  readonly expectedAttendance: number | null;
  /** Null when the event has no expected attendance yet, so there is nothing to compare. */
  readonly withinCapacity: boolean | null;
}

/**
 * SPM-104: capacity is read from the booking's chosen layout (#112). The
 * venue-level `capacity` is deliberately not consulted -- how it relates to the
 * layout figures is SPM-106. Exactly at the layout's capacity is within it.
 */
export function checkLayoutCapacity(
  venue: Venue,
  layout: string,
  expectedAttendance: number | null,
): LayoutCapacityCheck {
  const supported = venue.layouts.find((candidate) => candidate.name === layout);
  if (supported === undefined) {
    throw new UnsupportedRoomLayoutError(layout);
  }
  return {
    layout,
    capacity: supported.capacity,
    expectedAttendance,
    withinCapacity: expectedAttendance === null ? null : expectedAttendance <= supported.capacity,
  };
}

/**
 * SPM-104: a search that matched on one layout's capacity carries that layout
 * into the booking request as its default. Null when the search named none, or
 * the venue does not support it.
 */
export function layoutFromSearch(venue: Venue, searchedLayout: string | null): string | null {
  const layout = searchedLayout?.trim() ?? "";
  return venue.layouts.some((supported) => supported.name === layout) ? layout : null;
}
