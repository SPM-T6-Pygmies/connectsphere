import { describe, expect, it } from "vitest";

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

function build() {
  const venues = new InMemoryVenueCatalogue();
  return {
    venues,
    create: new CreateVenueUseCase({ venues }),
    update: new UpdateVenueUseCase({ venues }),
    list: new ListVenuesUseCase({ venues }),
    view: new ViewVenueUseCase({ venues }),
  };
}

function newVenue(overrides: Partial<CreateVenueCommand> = {}): CreateVenueCommand {
  return {
    roles: STAFF,
    location: "Marina Bay Hall",
    facilities: "Projector",
    accessibility: "Step-free access",
    operatingHoursStart: "08:00",
    operatingHoursEnd: "22:00",
    capacity: 300,
    bookingHorizonDays: 180,
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
        facilities: "Projector, Wi-Fi",
        accessibility: "Hearing loop, Lift access",
      }),
    );

    const stored = (await view.execute({ venueId: venue.id })).venue;

    expect(stored.facilities).toBe("Projector, Wi-Fi");
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
    "Event Operations Manager",
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
