import {
  blockedTimes,
  clashingTimes,
  type BookingId,
  type BookingRequest,
  type OccupiedTime,
} from "@/core/domain/booking";
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  BookingRoomLayoutNotChangeableError,
  CancelledEventBookingError,
  CoordinatorEventNotFoundError,
  InvalidBookingDateError,
  NoBookingSlotsError,
  NoFlagToReRequestError,
  ReRequestPendingError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
  VenueNotFoundError,
  VenueSlotBlockedError,
  VenueSlotUnavailableError,
} from "@/core/domain/errors";
import type { TimeRangeOnDate } from "@/core/domain/event-times";
import type { UserAccountId } from "@/core/domain/user-account";
import type { VenueId } from "@/core/domain/venue";
import type {
  BookingRepository,
  EventBookingSummary,
} from "@/core/ports/outbound/booking-repository";

import {
  toChangeRoomLayoutArgs,
  toEventBookingSummary,
  toOccupiedTime,
  toSubmitBookingArgs,
  type BookedSlotRow,
  type EventBookingRow,
} from "./booking-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import { expireLapsedHolds } from "./expire-lapsed-holds";

// SQLSTATEs raised by coordinator_submit_booking_request (see its migration).
const EVENT_NOT_FOUND = "CS020";
const VENUE_NOT_FOUND = "CS021";
const LAYOUT_REQUIRED = "CS022";
const LAYOUT_UNSUPPORTED = "CS023";
const SLOTS_INVALID = "CS024";
const SLOT_TAKEN = "CS025";
// Raised by the booking_slot trigger when a Venue Staff block covers a requested slot (SPM-21).
const SLOT_BLOCKED = "CS028";
// The event was cancelled (SPM-55 AC6).
const EVENT_CANCELLED = "CS077";
// SPM-251: the booking a re-request replaces has no open flag, or another re-request for it is waiting.
// CS026 (below) is its not-on-this-event.
const NO_FLAG_TO_RE_REQUEST = "CS085";
const RE_REQUEST_PENDING = "CS086";

// SQLSTATEs raised by coordinator_change_booking_room_layout (CS022 and CS023 are shared).
const BOOKING_NOT_FOUND = "CS026";
const BOOKING_NOT_PENDING = "CS027";

// Raised by coordinator_cancel_booking (CS026 is shared).
const BOOKING_NOT_CANCELLABLE = "CS075";

/**
 * Reached through `security definer` functions, not the tables: `booking`
 * and `booking_slot` have RLS enabled with no policies.
 */
export class SupabaseBookingRepository implements BookingRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listSlotsAt(venue: VenueId, dates: readonly string[]): Promise<readonly OccupiedTime[]> {
    const key = toKey(venue);
    if (key === null || dates.length === 0) {
      return [];
    }

    const { data, error } = await this.client.rpc("venue_booked_slots", {
      p_venue_id: key,
      p_dates: [...dates],
    });
    if (error) {
      throw new Error(`Failed to read the venue's booked slots: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as BookedSlotRow[]).map(toOccupiedTime);
  }

  async listForEvent(
    coordinatorId: UserAccountId,
    eventId: string,
  ): Promise<readonly EventBookingSummary[]> {
    const coordinator = toKey(coordinatorId);
    const event = toKey(eventId);
    if (coordinator === null || event === null) {
      return [];
    }

    // SPM-253: a hold that ran out is marked Expired before it is listed.
    await expireLapsedHolds(this.client);
    const { data, error } = await this.client.rpc("coordinator_event_bookings", {
      p_coordinator_user_account_id: coordinator,
      p_event_id: event,
    });
    if (error) {
      throw new Error(`Failed to list the event's bookings: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as EventBookingRow[]).map(toEventBookingSummary);
  }

  /**
   * The function re-checks the assignment, the layout, the slots and any
   * clash under a lock on the venue, and writes the audit record in the same
   * transaction. Its SQLSTATEs come back as the domain's own errors, so
   * losing a race to a booking confirmed a moment ago reads exactly like
   * finding it already there.
   */
  async submit(request: BookingRequest): Promise<BookingId> {
    const args = toSubmitBookingArgs(request);
    if (args === null) {
      // No row this store issued has an id like that.
      throw new CoordinatorEventNotFoundError(request.eventId);
    }

    const { data, error } = await this.client.rpc("coordinator_submit_booking_request", args);
    if (error) {
      switch (error.code) {
        case EVENT_NOT_FOUND:
          throw new CoordinatorEventNotFoundError(request.eventId);
        case EVENT_CANCELLED:
          // Cancelled since the use case read it.
          throw new CancelledEventBookingError();
        case VENUE_NOT_FOUND:
          throw new VenueNotFoundError();
        case LAYOUT_REQUIRED:
          throw new RoomLayoutRequiredError();
        case LAYOUT_UNSUPPORTED:
          throw new UnsupportedRoomLayoutError(request.roomLayout ?? "");
        case SLOTS_INVALID:
          // The domain refuses these before the call; reaching here means the
          // two disagree, and the date is the likeliest culprit.
          throw request.times.length === 0
            ? new NoBookingSlotsError()
            : new InvalidBookingDateError(request.times.map(({ date }) => date).join(", "));
        case SLOT_TAKEN:
          throw new VenueSlotUnavailableError(await this.takenOf(request));
        case SLOT_BLOCKED:
          throw new VenueSlotBlockedError(
            await this.blockedOf(request.venueId, request.times, error.message),
          );
        // The use case read the flag open and nothing waiting a moment ago; it moved since.
        case BOOKING_NOT_FOUND:
          throw new BookingNotFoundError(request.replacesBookingId ?? "");
        case NO_FLAG_TO_RE_REQUEST:
          throw new NoFlagToReRequestError(request.replacesBookingId ?? "");
        case RE_REQUEST_PENDING:
          throw new ReRequestPendingError(request.replacesBookingId ?? "");
        default:
          throw new Error(`Failed to submit the booking request: ${error.message}`, {
            cause: error,
          });
      }
    }

    return String(data) as BookingId;
  }

  /**
   * The function re-checks that the booking is on one of the coordinator's
   * events, that it is still pending and that the venue supports the layout,
   * and writes the audit record in the same transaction.
   */
  async changeRoomLayout(
    coordinatorId: UserAccountId,
    bookingId: string,
    roomLayout: string | null,
  ): Promise<void> {
    const args = toChangeRoomLayoutArgs(coordinatorId, bookingId, roomLayout);
    if (args === null) {
      // No row this store issued has an id like that.
      throw new BookingNotFoundError(bookingId);
    }

    const { error } = await this.client.rpc(
      "coordinator_change_booking_room_layout",
      args,
    );
    if (error) {
      switch (error.code) {
        case BOOKING_NOT_FOUND:
          throw new BookingNotFoundError(bookingId);
        case BOOKING_NOT_PENDING:
          // The use case read the status a moment ago; it moved since.
          throw new BookingRoomLayoutNotChangeableError("decided");
        case LAYOUT_REQUIRED:
          throw new RoomLayoutRequiredError();
        case LAYOUT_UNSUPPORTED:
          throw new UnsupportedRoomLayoutError(roomLayout ?? "");
        default:
          throw new Error(
            `Failed to change the booking's layout: ${error.message}`,
            {
              cause: error,
            },
          );
      }
    }
  }

  /**
   * SPM-20: the function re-checks that the booking is on one of the
   * coordinator's events and still holds its slots, under the same lock on the
   * venue a request and a decision take, and writes the audit record in the
   * same transaction.
   */
  async cancel(coordinatorId: UserAccountId, bookingId: string): Promise<void> {
    const coordinator = toKey(coordinatorId);
    const booking = toKey(bookingId);
    if (coordinator === null || booking === null) {
      // No row this store issued has an id like that.
      throw new BookingNotFoundError(bookingId);
    }

    const { error } = await this.client.rpc("coordinator_cancel_booking", {
      p_coordinator_user_account_id: coordinator,
      p_booking_id: booking,
    });
    if (error) {
      switch (error.code) {
        case BOOKING_NOT_FOUND:
          throw new BookingNotFoundError(bookingId);
        case BOOKING_NOT_CANCELLABLE:
          // The use case read the status a moment ago; it moved since.
          throw new BookingNotCancellableError("decided");
        default:
          throw new Error(`Failed to cancel the booking: ${error.message}`, { cause: error });
      }
    }
  }

  /** Which of the request's times were taken, for a message that names them. */
  private async takenOf(request: BookingRequest) {
    const occupied = await this.listSlotsAt(
      request.venueId,
      [...new Set(request.times.map(({ date }) => date))],
    );
    return clashingTimes(
      request.times,
      occupied.filter(({ bookingId }) => bookingId !== request.replacesBookingId),
      new Date(),
    );
  }

  /**
   * Which of a booking's times are blocked, for a message that names them.
   * The trigger stops at the first slot; the read says them all. If a lift
   * landed in between and nothing is blocked any more, the database's own
   * message still names the time it refused. Venue Staff's approval reads it
   * too (SPM-22).
   */
  async blockedOf(
    venue: VenueId,
    times: readonly TimeRangeOnDate[],
    refusal: string,
  ): Promise<TimeRangeOnDate[]> {
    const key = toKey(venue);
    const dates = times.map(({ date }) => date).sort();
    if (key !== null && dates.length > 0) {
      const { data } = await this.client.rpc("venue_blocked_slots", {
        p_venue_id: key,
        p_from: dates[0],
        p_to: dates[dates.length - 1],
      });
      const blocks = ((data ?? []) as unknown as Array<{ date: string; slot: string }>).map(
        ({ date, slot }) => ({ date: date.slice(0, 10), slot }),
      );
      const named = blockedTimes(times, blocks);
      if (named.length > 0) {
        return named;
      }
    }

    const fromMessage = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})–(\d{2}:\d{2})/.exec(refusal);
    return fromMessage === null
      ? []
      : [{ date: fromMessage[1], start: fromMessage[2], end: fromMessage[3] }];
  }
}
