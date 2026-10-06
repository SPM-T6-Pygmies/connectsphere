import type { BookingId, BookingSlot, BookingStatus, SlotOnDate } from "@/core/domain/booking";
import {
  UnavailabilityAlreadyLiftedError,
  VenueUnavailabilityNotFoundError,
} from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type { VenueId } from "@/core/domain/venue";
import {
  slotsStillBlocked,
  type BlockedSlot,
  type UnavailabilityLift,
  type VenueUnavailabilityBlock,
  type VenueUnavailabilityEntry,
} from "@/core/domain/venue-unavailability";
import type { Clock } from "@/core/ports/outbound/clock";
import type {
  AffectedBooking,
  VenueUnavailabilityRepository,
} from "@/core/ports/outbound/venue-unavailability-repository";

/** A booking the adapter knows of, so it can say which a block overlaps. */
export interface SeededBooking {
  readonly id: string;
  readonly venueId: string;
  readonly eventName: string;
  readonly status: BookingStatus;
  readonly slots: readonly SlotOnDate[];
}

const LIVE: readonly BookingStatus[] = ["Requested", "Tentative Hold", "Confirmed"];

/** A `Map`-backed store that obeys the same contract as the Supabase one. */
export class InMemoryVenueUnavailabilityRepository implements VenueUnavailabilityRepository {
  private readonly rows: VenueUnavailabilityEntry[] = [];
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
    return entry;
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
  }

  async affectedBookings(
    _reader: UserAccountId,
    venueId: VenueId,
    slots: readonly SlotOnDate[],
  ): Promise<readonly AffectedBooking[]> {
    const covered = new Set(slots.map(({ date, slot }) => `${date}|${slot}`));
    return this.bookings
      .filter((booking) => booking.venueId === venueId && LIVE.includes(booking.status))
      .flatMap((booking) =>
        booking.slots
          .filter(({ date, slot }) => covered.has(`${date}|${slot}`))
          .map(({ date, slot }) => ({
            bookingId: booking.id as BookingId,
            eventName: booking.eventName,
            status: booking.status,
            date,
            slot: slot as BookingSlot,
          })),
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
