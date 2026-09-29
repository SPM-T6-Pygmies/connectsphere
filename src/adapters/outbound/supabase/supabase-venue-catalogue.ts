import {
  InvalidVenueError,
  VenueMaintenanceNotPermittedError,
  VenueNotFoundError,
} from "@/core/domain/errors";
import type { Venue, VenueDetails, VenueId } from "@/core/domain/venue";
import type { VenueCatalogue } from "@/core/ports/outbound/venue-catalogue";

import type { SupabaseServerClient } from "./client";
import { toVenue, toVenueArgument, type VenueRow } from "./venue-mapper";

// Raised by supabase/migrations/20260924000000_venue_catalogue_maintenance.sql.
const NOT_PERMITTED = "CS020";
const NOT_FOUND = "CS021";
const INVALID = "CS022";

/**
 * The venue catalogue in Postgres, through the `venue_catalogue*` functions.
 *
 * Writes go through functions because a venue and its layouts are one
 * transaction and the database, not this adapter, decides whether the caller is
 * Venue Staff. Each write is followed by a read of the row it reports, so what
 * comes back is what was actually stored -- a write the database swallowed
 * would surface here rather than look like success.
 */
export class SupabaseVenueCatalogue implements VenueCatalogue {
  constructor(private readonly client: SupabaseServerClient) {}

  async list(): Promise<readonly Venue[]> {
    const { data, error } = await this.client.rpc("venue_catalogue");
    if (error) throw new Error(`Failed to list venues: ${error.message}`, { cause: error });

    return (data as VenueRow[]).map(toVenue);
  }

  async find(id: VenueId): Promise<Venue | null> {
    const { data, error } = await this.client.rpc("venue_catalogue", { p_venue_id: Number(id) });
    if (error) throw new Error(`Failed to read venue: ${error.message}`, { cause: error });

    const [row] = data as VenueRow[];
    return row === undefined ? null : toVenue(row);
  }

  async add(details: VenueDetails): Promise<Venue> {
    const { data, error } = await this.client.rpc("venue_catalogue_create", {
      p_venue: toVenueArgument(details),
    });
    if (error) throw translate(error, "create venue");

    return this.readStored(String(data));
  }

  async revise(id: VenueId, details: VenueDetails): Promise<Venue> {
    const { data, error } = await this.client.rpc("venue_catalogue_update", {
      p_venue_id: Number(id),
      p_venue: toVenueArgument(details),
    });
    if (error) throw translate(error, "update venue");

    return this.readStored(String(data));
  }

  private async readStored(id: string): Promise<Venue> {
    const stored = await this.find(id as VenueId);
    if (stored === null) {
      throw new Error(`Venue ${id} was reported saved but cannot be read back.`);
    }
    return stored;
  }
}

function translate(error: { code?: string; message: string }, action: string): Error {
  if (error.code === NOT_PERMITTED) return new VenueMaintenanceNotPermittedError();
  if (error.code === NOT_FOUND) return new VenueNotFoundError();
  if (error.code === INVALID) return new InvalidVenueError(error.message);
  return new Error(`Failed to ${action}: ${error.message}`, { cause: error });
}
