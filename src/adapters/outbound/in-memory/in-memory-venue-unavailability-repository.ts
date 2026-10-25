import {
  blockedTimes,
  holdsSlot,
  slotTime,
  type BookingId,
  type BookingStatus,
  type SlotOnDate,
} from "@/core/domain/booking";
import {
  blockFlagDetail,
  bookingsToFlagForBlock,
  timeSpans,
  type FlagReasonCode,
} from "@/core/domain/booking-review-flag";
import {
  UnavailabilityAlreadyLiftedError,
  VenueUnavailabilityNotFoundError,
} from "@/core/domain/errors";
import type { SlotCodeOnDate } from "@/core/domain/slot-grid";
import type { UserAccountId } from "@/core/domain/user-account";
import type { VenueId } from "@/core/domain/venue";
import type { CalendarBlock } from "@/core/domain/venue-calendar";
import {
  slotsStillBlocked,
  type BlockedSlot,
  type UnavailabilityLift,
  type VenueUnavailabilityBlock,
  type VenueUnavailabilityEntry,
} from "@/core/domain/venue-unavailability";
import type { BookingFlagRepository, EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";
import type { Clock } from "@/core/ports/outbound/clock";
import type {
  AffectedBooking,
  FlaggedBooking,
  VenueUnavailabilityRepository,
} from "@/core/ports/outbound/venue-unavailability-repository";

/** A booking the adapter knows of, so it can say which a block overlaps. */
export interface SeededBooking {
  readonly id: string;
  readonly venueId: string;
  readonly eventName: string;
  readonly status: BookingStatus;
  readonly slots: readonly SlotOnDate[];
  /** SPM-313: only needed by a case that reads flags. */
  readonly eventId?: string;
  readonly coordinatorUserAccountId?: string | null;
  readonly holdExpiresAt?: Date | null;
}

/** A flag as stored: the reason, and the slots it names so a lift can restate it. */
interface StoredFlag {
  readonly id: string;
  readonly booking: SeededBooking;
  readonly reasonCode: FlagReasonCode;
  readonly blockId: string;
  readonly detail: string;
  readonly flaggedAt: string;
}

const LIVE: readonly BookingStatus[] = ["Requested", "Tentative Hold", "Confirmed"];

/**
 * A `Map`-backed store that obeys the same contract as the Supabase one. It is also the flag
 * store (SPM-313): recording a block flags the bookings it was seeded with, as the database
 * function does, so a case sees the flags through `BookingFlagRepository` too.
 */
export class InMemoryVenueUnavailabilityRepository
  implements VenueUnavailabilityRepository, BookingFlagRepository
{
  private readonly rows: VenueUnavailabilityEntry[] = [];
  private readonly flags: StoredFlag[] = [];
  /** SPM-313: a booking's status once something has ended it (cancelled, released, expired). */
  private readonly endedAs = new Map<string, BookingStatus>();
  private sequence = 0;

  constructor(
    private readonly clock: Clock,
    private readonly venueLocations: ReadonlyMap<string, string> = new Map(),
    private readonly staffNames: ReadonlyMap<string, string> = new Map(),
    private readonly bookings: readonly SeededBooking[] = [],
  ) {}

  private nameOf(staff: UserAccountId): string {
    return this.staffNames.get(staff) ?? staff;
  }

  /** Test helper: something outside this store ended the booking, as cancelling does. */
  endBooking(bookingId: string, status: BookingStatus): void {
    this.endedAs.set(bookingId, status);
  }

  /** A flag on a booking that no longer holds its slot has nothing left to review, so it is not shown. */
  private stillHolds(booking: SeededBooking): boolean {
    return holdsSlot(
      { status: this.endedAs.get(booking.id) ?? booking.status, holdExpiresAt: booking.holdExpiresAt ?? null },
      this.clock.now(),
    );
  }

  async record(block: VenueUnavailabilityBlock, actor: UserAccountId): Promise<VenueUnavailabilityEntry> {
    this.sequence += 1;
    const entry: VenueUnavailabilityEntry = {
      ...block,
      id: `unavailability-${this.sequence}`,
      venueLocation: this.venueLocations.get(block.venueId) ?? block.venueId,
      status: "In force",
      recordedByName: this.nameOf(actor),
      recordedAt: this.clock.now().toISOString(),
      liftedByName: null,
      liftedAt: null,
    };
    this.rows.push(entry);
    this.flagBookingsFor(entry);
    return entry;
  }

  /** The rule is the domain's; this stores what it decided, once per block (AC5). */
  private flagBookingsFor(entry: VenueUnavailabilityEntry): void {
    const now = this.clock.now();
    const flaggable = this.bookings.map((booking) => ({
      id: booking.id,
      venueId: booking.venueId as VenueId,
      status: booking.status,
      holdExpiresAt: booking.holdExpiresAt ?? null,
      slots: booking.slots,
    }));
    for (const { bookingId } of bookingsToFlagForBlock(entry, flaggable, now)) {
      const booking = this.bookings.find((candidate) => candidate.id === bookingId);
      if (booking === undefined) {
        continue;
      }
      this.flags.push({
        id: `flag-${this.flags.length + 1}`,
        booking,
        reasonCode: "venue-unavailable",
        blockId: entry.id,
        detail: blockFlagDetail(entry, booking.slots),
        flaggedAt: now.toISOString(),
      });
    }
  }

  async list(): Promise<readonly VenueUnavailabilityEntry[]> {
    return [...this.rows];
  }

  async find(_reader: UserAccountId, id: string): Promise<VenueUnavailabilityEntry | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async lift(lift: UnavailabilityLift): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === lift.id);
    if (index === -1) {
      throw new VenueUnavailabilityNotFoundError();
    }
    if (this.rows[index].status === "Lifted") {
      throw new UnavailabilityAlreadyLiftedError();
    }
    this.rows[index] = {
      ...this.rows[index],
      status: "Lifted",
      liftedByName: this.nameOf(lift.liftedBy),
      liftedAt: lift.liftedAt.toISOString(),
    };
    // SPM-313 AC6: the flags stay open; `openForEvent` says the block was lifted, from the block.
  }

  async flaggedBookings(_reader: UserAccountId, blockId: string): Promise<readonly FlaggedBooking[]> {
    return this.flags
      .filter((flag) => flag.blockId === blockId && this.stillHolds(flag.booking))
      .map(({ booking, detail }) => ({
        bookingId: booking.id as BookingId,
        eventId: booking.eventId ?? "",
        eventName: booking.eventName,
        coordinatorUserAccountId: booking.coordinatorUserAccountId ?? null,
        venueLocation: this.venueLocations.get(booking.venueId) ?? booking.venueId,
        detail,
      }));
  }

  async openForEvent(coordinatorId: UserAccountId, eventId: string): Promise<readonly EventBookingFlag[]> {
    return this.flags
      .filter(
        ({ booking }) =>
          booking.eventId === eventId &&
          booking.coordinatorUserAccountId === coordinatorId &&
          this.stillHolds(booking),
      )
      .map((flag) => ({
        flagId: flag.id,
        bookingId: flag.booking.id as BookingId,
        venueLocation: this.venueLocations.get(flag.booking.venueId) ?? flag.booking.venueId,
        status: flag.booking.status,
        holdExpiresAt: flag.booking.holdExpiresAt?.toISOString() ?? null,
        bookedFor: timeSpans(flag.booking.slots),
        reasonCode: flag.reasonCode,
        detail: flag.detail,
        flaggedAt: flag.flaggedAt,
        sourceLiftedAt: this.rows.find((row) => row.id === flag.blockId)?.liftedAt ?? null,
      }));
  }

  async affectedBookings(
    _reader: UserAccountId,
    venueId: VenueId,
    slots: readonly SlotCodeOnDate[],
  ): Promise<readonly AffectedBooking[]> {
    return this.bookings
      .filter((booking) => booking.venueId === venueId && LIVE.includes(booking.status))
      .flatMap((booking) =>
        blockedTimes(booking.slots.map(slotTime), slots).map(({ date, start, end }) => ({
          bookingId: booking.id as BookingId,
          eventName: booking.eventName,
          status: booking.status,
          date,
          start,
          end,
        })),
      );
  }

  async blockedBetween(venueId: VenueId, from: string, to: string): Promise<readonly CalendarBlock[]> {
    return this.rows
      .filter((row) => row.status === "In force" && row.venueId === venueId)
      .flatMap((row) =>
        row.slots
          .filter(({ date }) => date >= from && date <= to)
          .map(({ date, slot }) => ({ date, slot, reason: row.reason, note: row.note })),
      );
  }

  /** The slots an In force block holds: what the booking store refuses (SPM-21 AC12). */
  blockedSlots(): readonly BlockedSlot[] {
    return slotsStillBlocked(this.rows);
  }

  /** Test helper: the bookings as seeded, to show a block left them alone. */
  seededBookings(): readonly SeededBooking[] {
    return this.bookings;
  }
}
