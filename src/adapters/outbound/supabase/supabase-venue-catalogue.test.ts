import { describe, expect, it } from "vitest";

import {
  InvalidVenueError,
  VenueMaintenanceNotPermittedError,
  VenueNotFoundError,
} from "@/core/domain/errors";
import { venueId } from "@/core/domain/venue";

import type { SupabaseServerClient } from "./client";
import { SupabaseVenueCatalogue } from "./supabase-venue-catalogue";
import type { VenueRow } from "./venue-mapper";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(answers: Record<string, RpcResult>) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return answers[name] ?? { data: null, error: { message: `unexpected call to ${name}` } };
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

const ROW: VenueRow = {
  venue_id: 5,
  location: "Main Hall",
  facilities: "Wi-Fi",
  accessibility: "Lift access",
  opening_hours: [{ start: "07:00", end: "12:00" }],
  capacity: 300,
  booking_horizon_days: 90,
  setup_minutes: 30,
  turnaround_minutes: 45,
  layouts: [{ name: "Theatre", capacity: 200 }],
};

const DETAILS = {
  location: "Main Hall",
  facilities: "Wi-Fi",
  accessibility: "Lift access",
  openingHours: [{ start: "07:00", end: "12:00" }],
  capacity: 300,
  bookingHorizonDays: 90,
  setupMinutes: 30,
  turnaroundMinutes: 45,
  layouts: [{ name: "Theatre", capacity: 200 }],
};

describe("SupabaseVenueCatalogue setup and turnaround (SPM-23)", () => {
  it("AC1: sends the two values to the database and reads the stored venue back with them", async () => {
    const { client, calls } = fakeClient({
      venue_catalogue_create: { data: 5, error: null },
      venue_catalogue: { data: [ROW], error: null },
    });

    const venue = await new SupabaseVenueCatalogue(client).add(DETAILS);

    expect(calls[0].args).toMatchObject({ p_venue: { setup_minutes: 30, turnaround_minutes: 45 } });
    expect(venue).toMatchObject({ setupMinutes: 30, turnaroundMinutes: 45 });
  });

  it("AC3: sends a locked venue's own values back on an update", async () => {
    const { client, calls } = fakeClient({
      venue_catalogue_update: { data: 5, error: null },
      venue_catalogue: { data: [ROW], error: null },
    });

    await new SupabaseVenueCatalogue(client).revise(venueId("5"), DETAILS);

    expect(calls[0]).toEqual({
      name: "venue_catalogue_update",
      args: expect.objectContaining({
        p_venue_id: 5,
        p_venue: expect.objectContaining({ setup_minutes: 30, turnaround_minutes: 45 }),
      }),
    });
  });

  it("AC3: maps the database's lock refusal (CS080) to the domain's, naming the setup box", async () => {
    const { client } = fakeClient({
      venue_catalogue_update: {
        data: null,
        error: { code: "CS080", message: "Setup and turnaround time are locked once defined" },
      },
    });

    const error = await new SupabaseVenueCatalogue(client).revise(venueId("5"), DETAILS).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidVenueError);
    expect((error as InvalidVenueError).field).toBe("setupMinutes");
    expect((error as InvalidVenueError).message).toMatch(/locked/);
  });

  it("maps the unique-location index to the duplicate-location refusal, on create and on update", async () => {
    const taken = { code: "23505", message: 'duplicate key value violates unique constraint "venue_location_unique_idx"' };
    const create = fakeClient({ venue_catalogue_create: { data: null, error: taken } });
    const update = fakeClient({ venue_catalogue_update: { data: null, error: taken } });

    const created = await new SupabaseVenueCatalogue(create.client).add(DETAILS).catch((e: unknown) => e);
    const revised = await new SupabaseVenueCatalogue(update.client).revise(venueId("5"), DETAILS).catch((e: unknown) => e);

    for (const error of [created, revised]) {
      expect(error).toBeInstanceOf(InvalidVenueError);
      expect((error as InvalidVenueError).field).toBe("location");
      expect((error as InvalidVenueError).message).toMatch(/already exists/);
    }
  });

  it("keeps mapping the older refusals: not permitted, not found, and an invalid record", async () => {
    const refuse = (code: string) =>
      new SupabaseVenueCatalogue(
        fakeClient({ venue_catalogue_update: { data: null, error: { code, message: "x" } } }).client,
      )
        .revise(venueId("5"), DETAILS)
        .catch((e: unknown) => e);

    expect(await refuse("CS020")).toBeInstanceOf(VenueMaintenanceNotPermittedError);
    expect(await refuse("CS021")).toBeInstanceOf(VenueNotFoundError);
    expect(await refuse("CS022")).toBeInstanceOf(InvalidVenueError);
  });

  it("surfaces any other database fault as a failure, not a domain refusal", async () => {
    const { client } = fakeClient({
      venue_catalogue_update: { data: null, error: { code: "XX000", message: "boom" } },
    });

    await expect(new SupabaseVenueCatalogue(client).revise(venueId("5"), DETAILS)).rejects.toThrow(
      "Failed to update venue: boom",
    );
  });
});

describe("SupabaseVenueCatalogue finding a venue", () => {
  it("reads a venue by its numeric key", async () => {
    const { client, calls } = fakeClient({ venue_catalogue: { data: [ROW], error: null } });

    const venue = await new SupabaseVenueCatalogue(client).find(venueId("5"));

    expect(calls).toEqual([{ name: "venue_catalogue", args: { p_venue_id: 5 } }]);
    expect(venue).toMatchObject({ location: "Main Hall" });
  });

  // `venue_catalogue` reads a null id as "every venue", so a key that isn't one
  // must never reach it: the first venue would come back as the answer.
  it.each(["abc", "1e3", "5.0"])("treats %j as not found, without asking the database", async (id) => {
    const { client, calls } = fakeClient({ venue_catalogue: { data: [ROW], error: null } });

    const venue = await new SupabaseVenueCatalogue(client).find(venueId(id));

    expect(venue).toBeNull();
    expect(calls).toEqual([]);
  });
});
