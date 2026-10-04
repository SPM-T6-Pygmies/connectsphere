import { describe, expect, it } from "vitest";

import { changeBookingRoomLayoutSchema } from "./change-booking-room-layout-schema";

const valid = {
  eventId: "7",
  eventRequestId: "24",
  bookingId: "12",
  roomLayout: "Boardroom",
};

describe("changeBookingRoomLayoutSchema (SPM-104)", () => {
  it("reads the event, the booking and the layout name", () => {
    expect(changeBookingRoomLayoutSchema.parse(valid)).toEqual(valid);
  });

  it("trims the layout name", () => {
    expect(
      changeBookingRoomLayoutSchema.parse({
        ...valid,
        roomLayout: "  Boardroom ",
      }).roomLayout,
    ).toBe("Boardroom");
  });

  it("reads a blank layout as none given, for the domain to judge", () => {
    expect(
      changeBookingRoomLayoutSchema.parse({ ...valid, roomLayout: "  " })
        .roomLayout,
    ).toBeNull();
  });

  it.each(["eventId", "eventRequestId", "bookingId"] as const)(
    "refuses a missing %s",
    (field) => {
      expect(
        changeBookingRoomLayoutSchema.safeParse({ ...valid, [field]: "" })
          .success,
      ).toBe(false);
    },
  );
});
