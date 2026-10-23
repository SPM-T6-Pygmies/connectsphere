import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import {
  InMemoryUpcomingVenueBookings,
  type KnownVenueBooking,
} from "@/adapters/outbound/in-memory/in-memory-upcoming-venue-bookings";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";

import {
  InvalidVenueError,
  VenueMaintenanceNotPermittedError,
  VenueNotFoundError,
} from "../domain/errors";
import { CreateVenueUseCase, type CreateVenueCommand } from "./create-venue";
import { UpdateVenueUseCase } from "./update-venue";
import { ListVenuesUseCase, ViewVenueUseCase } from "./view-venues";

const STAFF = ["Venue Staff"];

/** Monday 14 December 2026, 10:00 in Singapore. */
const NOW = new Date("2026-12-14T02:00:00.000Z");

function build() {
  const venues = new InMemoryVenueCatalogue();
  const bookings: KnownVenueBooking[] = [];
  return {
    venues,
    bookings,
    create: new CreateVenueUseCase({ venues }),
    update: new UpdateVenueUseCase({
      venues,
      upcomingBookings: new InMemoryUpcomingVenueBookings(bookings),
      clock: new FixedClock(NOW),
    }),
    list: new ListVenuesUseCase({ venues }),
    view: new ViewVenueUseCase({ venues }),
  };
}

function newVenue(overrides: Partial<CreateVenueCommand> = {}): CreateVenueCommand {
  return {
    roles: STAFF,
    location: "Marina Bay Hall",
    facilities: "Wi-Fi",
    accessibility: "Step-free access",
    openingHours: [{ start: "07:00", end: "12:00" }, { start: "13:00", end: "18:00" }, { start: "19:00", end: "24:00" }],
    capacity: 300,
    bookingHorizonDays: 180,
    setupMinutes: null,
    turnaroundMinutes: null,
    layouts: [
      { name: "Theatre", capacity: 200 },
      { name: "Banquet", capacity: 120 },
    ],
    ...overrides,
  };
}

describe("CreateVenueUseCase (SPM-146)", () => {
  it("stores a venue with two layouts, each with its supplied capacity", async () => {
    const { create, view } = build();

    const { venue } = await create.execute(newVenue());
    const stored = await view.execute({ venueId: venue.id });

    expect(stored.venue.layouts).toEqual([
      { name: "Theatre", capacity: 200 },
      { name: "Banquet", capacity: 120 },
    ]);
    expect(stored.venue.location).toBe("Marina Bay Hall");
  });

  it("rejects a layout without a usable capacity and stores nothing", async () => {
    const { create, list } = build();

    await expect(
      create.execute(newVenue({ layouts: [{ name: "Theatre", capacity: 0 }] })),
    ).rejects.toBeInstanceOf(InvalidVenueError);
    expect((await list.execute()).venues).toEqual([]);
  });

  it("rejects a venue with no location and stores nothing", async () => {
    const { create, list } = build();

    await expect(create.execute(newVenue({ location: "" }))).rejects.toBeInstanceOf(
      InvalidVenueError,
    );
    expect((await list.execute()).venues).toEqual([]);
  });
});

describe("UpdateVenueUseCase (SPM-147)", () => {
  it("persists an updated layout capacity, and it shows on the next read", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue());

    await update.execute({
      ...newVenue(),
      venueId: venue.id,
      layouts: [
        { name: "Theatre", capacity: 250 },
        { name: "Banquet", capacity: 120 },
      ],
    });

    const { venue: reread } = await view.execute({ venueId: venue.id });
    expect(reread.layouts).toContainEqual({ name: "Theatre", capacity: 250 });
  });

  it("adds a layout and removes one left out of the list", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue());

    await update.execute({
      ...newVenue(),
      venueId: venue.id,
      layouts: [
        { name: "Theatre", capacity: 200 },
        { name: "Banquet", capacity: 40 },
      ],
    });

    const { venue: reread } = await view.execute({ venueId: venue.id });
    expect(reread.layouts.map((layout) => layout.name)).toEqual(["Theatre", "Banquet"]);
  });

  it("edits the venue's attributes", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue());

    await update.execute({ ...newVenue(), venueId: venue.id, location: "Sentosa Pavilion" });

    expect((await view.execute({ venueId: venue.id })).venue.location).toBe("Sentosa Pavilion");
  });

  it("rejects a venue that is not in the catalogue", async () => {
    const { update } = build();

    await expect(update.execute({ ...newVenue(), venueId: "nope" })).rejects.toBeInstanceOf(
      VenueNotFoundError,
    );
  });

  it("leaves the stored venue unchanged when the update is invalid", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue());

    await expect(
      update.execute({
        ...newVenue(),
        venueId: venue.id,
        layouts: [{ name: "Theatre", capacity: -5 }],
      }),
    ).rejects.toBeInstanceOf(InvalidVenueError);

    expect((await view.execute({ venueId: venue.id })).venue.layouts).toHaveLength(2);
  });
});

describe("Venue lists are enforced on save (SPM-42)", () => {
  it("rejects a facility outside the list on create and stores nothing", async () => {
    const { create, list } = build();

    await expect(create.execute(newVenue({ facilities: "Trampoline" }))).rejects.toBeInstanceOf(
      InvalidVenueError,
    );
    expect((await list.execute()).venues).toEqual([]);
  });

  it("stores several facilities and accessibility features chosen from the lists", async () => {
    const { create, view } = build();
    const { venue } = await create.execute(
      newVenue({
        facilities: "Wi-Fi, Catering area",
        accessibility: "Hearing loop, Lift access",
      }),
    );

    const stored = (await view.execute({ venueId: venue.id })).venue;

    expect(stored.facilities).toBe("Wi-Fi, Catering area");
    expect(stored.accessibility).toBe("Hearing loop, Lift access");
  });

  it("leaves the stored venue unchanged when an update picks an unlisted layout", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue());

    await expect(
      update.execute({
        ...newVenue(),
        venueId: venue.id,
        layouts: [{ name: "Cabaret", capacity: 40 }],
      }),
    ).rejects.toBeInstanceOf(InvalidVenueError);

    expect((await view.execute({ venueId: venue.id })).venue.layouts).toHaveLength(2);
  });

  it("rejects an update that clears every accessibility feature", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue());

    await expect(
      update.execute({ ...newVenue(), venueId: venue.id, accessibility: "" }),
    ).rejects.toBeInstanceOf(InvalidVenueError);

    expect((await view.execute({ venueId: venue.id })).venue.accessibility).toBe(
      "Step-free access",
    );
  });
});

describe("Access control for venue maintenance (SPM-148)", () => {
  it("lets Venue Staff create and update, whatever the venue or location", async () => {
    const { create, update } = build();

    const { venue } = await create.execute(newVenue({ location: "Any location at all" }));

    await expect(
      update.execute({ ...newVenue(), venueId: venue.id, location: "Somewhere else" }),
    ).resolves.toBeDefined();
  });

  it.each([
    "Event Organiser",
    "Event Coordinator",
    "Event Coordinator Lead",
    "Technical Support Staff",
    "Attendee",
  ])("refuses %s, and stores nothing", async (role) => {
    const { create, update, list, venues } = build();
    const existing = await venues.add({ ...newVenue(), layouts: [] });

    await expect(create.execute(newVenue({ roles: [role] }))).rejects.toBeInstanceOf(
      VenueMaintenanceNotPermittedError,
    );
    await expect(
      update.execute({ ...newVenue(), roles: [role], venueId: existing.id, location: "Hijacked" }),
    ).rejects.toBeInstanceOf(VenueMaintenanceNotPermittedError);

    const { venues: all } = await list.execute();
    expect(all).toHaveLength(1);
    expect(all[0].location).toBe(existing.location);
  });
});

describe("Setup and turnaround time on create and update (SPM-23)", () => {
  it("AC1: stores the setup and turnaround a new venue is given", async () => {
    const { create, view } = build();

    const { venue } = await create.execute(newVenue({ setupMinutes: 30, turnaroundMinutes: 45 }));

    expect((await view.execute({ venueId: venue.id })).venue).toMatchObject({
      setupMinutes: 30,
      turnaroundMinutes: 45,
    });
  });

  it("AC1: stores a venue given 0 and 0 as defined, which is not the same as none", async () => {
    const { create } = build();

    const { venue } = await create.execute(newVenue({ setupMinutes: 0, turnaroundMinutes: 0 }));

    expect(venue.setupMinutes).toBe(0);
    expect(venue.turnaroundMinutes).toBe(0);
  });

  it("AC1, AC2: refuses a new venue with only one of them, or an off-grid one, and stores nothing", async () => {
    const { create, list } = build();

    await expect(create.execute(newVenue({ setupMinutes: 30 }))).rejects.toThrow("Enter the turnaround time too");
    await expect(create.execute(newVenue({ setupMinutes: 20, turnaroundMinutes: 30 }))).rejects.toThrow(
      /multiple of 15/,
    );
    expect((await list.execute()).venues).toEqual([]);
  });

  it("AC1: lets a venue with none defined be given both, once", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue());

    await update.execute({ ...newVenue({ setupMinutes: 30, turnaroundMinutes: 45 }), venueId: venue.id });

    expect((await view.execute({ venueId: venue.id })).venue).toMatchObject({
      setupMinutes: 30,
      turnaroundMinutes: 45,
    });
  });

  it("AC3: refuses changing a defined venue's values and leaves them as they were", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue({ setupMinutes: 30, turnaroundMinutes: 45 }));

    await expect(
      update.execute({ ...newVenue({ setupMinutes: 60, turnaroundMinutes: 45 }), venueId: venue.id }),
    ).rejects.toThrow(/locked/);
    await expect(
      update.execute({ ...newVenue({ setupMinutes: null, turnaroundMinutes: null }), venueId: venue.id }),
    ).rejects.toThrow(/locked/);

    expect((await view.execute({ venueId: venue.id })).venue).toMatchObject({
      setupMinutes: 30,
      turnaroundMinutes: 45,
    });
  });

  it("AC3: lets other details change while the locked values are sent back unchanged", async () => {
    const { create, update, view } = build();
    const { venue } = await create.execute(newVenue({ setupMinutes: 30, turnaroundMinutes: 45 }));

    await update.execute({
      ...newVenue({ setupMinutes: 30, turnaroundMinutes: 45, location: "Sentosa Pavilion" }),
      venueId: venue.id,
    });

    expect((await view.execute({ venueId: venue.id })).venue).toMatchObject({
      location: "Sentosa Pavilion",
      setupMinutes: 30,
      turnaroundMinutes: 45,
    });
  });

  it("AC3: a venue defined as 0 and 0 is locked at 0", async () => {
    const { create, update } = build();
    const { venue } = await create.execute(newVenue({ setupMinutes: 0, turnaroundMinutes: 0 }));

    await expect(
      update.execute({ ...newVenue({ setupMinutes: 15, turnaroundMinutes: 0 }), venueId: venue.id }),
    ).rejects.toThrow(/locked/);
  });

  it("AC5: refuses defining them while a booking that has not ended exists, naming why", async () => {
    const { create, update, bookings, view } = build();
    const { venue } = await create.execute(newVenue());
    bookings.push({ venueId: venue.id, status: "Confirmed", endsAt: new Date("2026-12-14T12:00:00+08:00") });

    await expect(
      update.execute({ ...newVenue({ setupMinutes: 30, turnaroundMinutes: 45 }), venueId: venue.id }),
    ).rejects.toThrow(/upcoming booking/);

    expect((await view.execute({ venueId: venue.id })).venue.setupMinutes ?? null).toBeNull();
  });

  it("AC5: lets them be defined when the only booking has ended, and when the booking is at another venue", async () => {
    const { create, update, bookings, view } = build();
    const { venue } = await create.execute(newVenue());
    const { venue: other } = await create.execute(newVenue({ location: "Elsewhere" }));
    bookings.push(
      { venueId: venue.id, status: "Confirmed", endsAt: new Date("2026-12-13T12:00:00+08:00") },
      { venueId: other.id, status: "Confirmed", endsAt: new Date("2026-12-20T12:00:00+08:00") },
    );

    await update.execute({ ...newVenue({ setupMinutes: 30, turnaroundMinutes: 45 }), venueId: venue.id });

    expect((await view.execute({ venueId: venue.id })).venue.setupMinutes).toBe(30);
  });

  it("AC5: an upcoming booking does not stop other details being edited while the values stay undefined", async () => {
    const { create, update, bookings, view } = build();
    const { venue } = await create.execute(newVenue());
    bookings.push({ venueId: venue.id, status: "Requested", endsAt: new Date("2026-12-20T12:00:00+08:00") });

    await update.execute({ ...newVenue({ location: "Renamed" }), venueId: venue.id });

    expect((await view.execute({ venueId: venue.id })).venue.location).toBe("Renamed");
  });
});
