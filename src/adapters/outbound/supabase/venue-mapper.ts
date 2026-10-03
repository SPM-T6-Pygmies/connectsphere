import { roomLayoutId, venueId, type SupportedRoomLayout, type Venue } from "@/core/domain/venue";
import type { VenueOption } from "@/core/ports/outbound/venue-repository";

/**
 * One row of `venues_for_booking()`/`venue()` -- a (venue, supported layout)
 * pair, `left join`ed so a venue with no recorded layout still returns one
 * row with the layout columns null. Several rows share one `venue_id`.
 */
export interface VenueBookingRow {
  venue_id: number;
  location: string;
  capacity: number | null;
  room_layout_id: number | null;
  room_layout_name: string | null;
  layout_capacity: number | null;
}

/** The domain's ids are opaque strings; this store numbers its rows. */
export function toKey(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

function supportedLayoutOf(row: VenueBookingRow): SupportedRoomLayout | null {
  if (row.room_layout_id === null || row.room_layout_name === null) {
    return null;
  }
  return {
    roomLayoutId: roomLayoutId(String(row.room_layout_id)),
    name: row.room_layout_name,
    capacity: row.layout_capacity,
  };
}

/** Groups the (venue, layout) rows `venues_for_booking()` returns into one `VenueOption` per `venue_id`. */
export function toVenueOptions(rows: readonly VenueBookingRow[]): readonly VenueOption[] {
  const byVenue = new Map<number, VenueBookingRow[]>();
  for (const row of rows) {
    const group = byVenue.get(row.venue_id);
    if (group) {
      group.push(row);
    } else {
      byVenue.set(row.venue_id, [row]);
    }
  }

  return [...byVenue.entries()].map(([id, group]) => ({
    id: venueId(String(id)),
    location: group[0]!.location,
    capacity: group[0]!.capacity,
    supportedLayouts: group.map(supportedLayoutOf).filter((layout) => layout !== null),
  }));
}

/** Groups the rows `venue(p_venue_id)` returns into the one `Venue` they describe, or `null` for an unknown venue. */
export function toVenue(rows: readonly VenueBookingRow[]): Venue | null {
  const [options] = toVenueOptions(rows);
  return options ?? null;
}
