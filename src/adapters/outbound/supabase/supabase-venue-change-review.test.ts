import { describe, expect, it } from "vitest";

import { VenueMaintenanceNotPermittedError } from "@/core/domain/errors";
import { venueId } from "@/core/domain/venue";

import type { SupabaseServerClient } from "./client";
import { SupabaseVenueChangeReview } from "./supabase-venue-change-review";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

/** A client whose `rpc` answers from a table of function name to result, and remembers the calls. */
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

const BOOKING_ROW = {
  booking_id: 812,
  event_id: 40,
  event_name: "Harbour Lights Gala",
  coordinator_user_account_id: 3,
  status: "Tentative Hold",
  hold_expires_at: "2026-11-01T02:00:00Z",
  room_layout_name: "Banquet",
  slots: [{ date: "2026-11-16", slot: "52" }],
  expected_attendance: 120,
  room_layout_preference: "Banquet",
  accessibility_requirements: null,
  required_facilities: "Wi-Fi",
};

describe("SupabaseVenueChangeReview (SPM-105)", () => {
  it("reads the venue's bookings, with their events' needs, through venue_change_bookings", async () => {
    const { client, calls } = fakeClient({ venue_change_bookings: { data: [BOOKING_ROW], error: null } });

    const bookings = await new SupabaseVenueChangeReview(client).bookingsAt(venueId("5"));

    expect(bookings).toEqual([
      {
        id: "812",
        eventId: "40",
        eventName: "Harbour Lights Gala",
        coordinatorUserAccountId: "3",
        status: "Tentative Hold",
        holdExpiresAt: new Date("2026-11-01T02:00:00Z"),
        slots: [{ date: "2026-11-16", slot: "52" }],
        roomLayoutName: "Banquet",
        needs: {
          expectedAttendance: 120,
          preferredLayout: "Banquet",
          accessibilityNeeds: null,
          requiredFacilities: "Wi-Fi",
        },
      },
    ]);
    expect(calls).toEqual([{ name: "venue_change_bookings", args: { p_venue_id: 5 } }]);
  });

  it("AC1, AC8: writes the reasons through venue_change_flag_bookings", async () => {
    const { client, calls } = fakeClient({ venue_change_flag_bookings: { data: null, error: null } });

    await new SupabaseVenueChangeReview(client).flag(venueId("5"), [
      { bookingId: "812", sourceRef: "capacity:Banquet", detail: "Capacity: Banquet seats 80, 40 over", startsFailing: true },
    ]);

    expect(calls).toEqual([
      {
        name: "venue_change_flag_bookings",
        args: {
          p_venue_id: 5,
          p_flags: [
            { booking_id: 812, source_ref: "capacity:Banquet", detail: "Capacity: Banquet seats 80, 40 over", starts_failing: true },
          ],
        },
      },
    ]);
  });

  it("turns the database's refusal of a non-Venue Staff caller into the domain's error", async () => {
    const refused = { data: null, error: { code: "CS020", message: "Only Venue Staff may maintain the venue catalogue" } };
    const { client } = fakeClient({ venue_change_bookings: refused, venue_change_flag_bookings: refused });
    const review = new SupabaseVenueChangeReview(client);

    await expect(review.bookingsAt(venueId("5"))).rejects.toThrow(VenueMaintenanceNotPermittedError);
    await expect(review.flag(venueId("5"), [])).rejects.toThrow(VenueMaintenanceNotPermittedError);
  });

  it("raises any other failure instead of saving as though nothing were flagged", async () => {
    const { client } = fakeClient({ venue_change_bookings: { data: null, error: { message: "boom" } } });

    await expect(new SupabaseVenueChangeReview(client).bookingsAt(venueId("5"))).rejects.toThrow(
      /Failed to read the venue's bookings: boom/,
    );
  });
});

describe("SupabaseVenueChangeReview (SPM-71)", () => {
  it("AC6: reads an event with no coordinator as nobody to tell", async () => {
    const { client } = fakeClient({
      venue_change_bookings: { data: [{ ...BOOKING_ROW, coordinator_user_account_id: null }], error: null },
    });

    const [booking] = await new SupabaseVenueChangeReview(client).bookingsAt(venueId("5"));

    expect(booking.coordinatorUserAccountId).toBeNull();
  });
});

describe("SupabaseVenueChangeReview lapses (SPM-111)", () => {
  it("AC3: returns the events the edit took out of Confirmed, with what each lacks", async () => {
    const { client } = fakeClient({
      venue_change_flag_bookings: {
        data: [
          {
            event_id: 1,
            event_name: "Operations Roadmap Conference",
            event_request_id: 6,
            owning_organiser_user_account_id: 9,
            lapsed: [{ kind: "flagged-booking", venue_location: "Main Hall" }],
          },
        ],
        error: null,
      },
    });

    const lapses = await new SupabaseVenueChangeReview(client).flag(venueId("5"), [
      { bookingId: "812", sourceRef: "capacity:Banquet", detail: "Capacity: Banquet seats 80, 40 over", startsFailing: true },
    ]);

    expect(lapses).toEqual([
      {
        eventId: "1",
        eventName: "Operations Roadmap Conference",
        eventRequestId: "6",
        owningOrganiserUserAccountId: "9",
        lapsed: [{ kind: "flagged-booking", venueLocation: "Main Hall" }],
      },
    ]);
  });
});
