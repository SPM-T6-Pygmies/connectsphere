/**
 * Seeded data for the workflow wireframes.
 *
 * One event per interesting state, so every screen has something to show and
 * the whole 14-step flow (wiki: event-request-workflow) can be walked without
 * a database. Dates are fixed strings rather than offsets from `Date.now()`:
 * these screens are rendered on the server and compared in screenshots, so a
 * stable date is worth more here than one that never goes stale.
 */

import type {
  BookingRecord,
  EquipmentReservationRecord,
  EventRecord,
  EventRequestRecord,
  Person,
  SupportRequestRecord,
  VenueRecord,
} from "./types";

// --- People ----------------------------------------------------------------

/**
 * Names and ids match scripts/seed-data/seed.sql (and
 * adapters/outbound/in-memory/organiser-demo-seed.ts): the same Alice, Ben,
 * Cara, Nadia and Omar exist for real once a Supabase project is configured,
 * so the wireframe and the seeded backend show the same people rather than
 * two unrelated casts. Daniel, Mei and Ravi (ops/venue/technical) are
 * wireframe-only for now -- see the seed script's own note on why they carry
 * this file's names rather than the other way round.
 */
export const PEOPLE = {
  organiserPriya: {
    id: "organiser-alice",
    name: "Alice",
    department: null,
    clientOrganisation: "Sunrise Events Co",
  },
  organiserWeiLin: {
    id: "organiser-ben",
    name: "Ben",
    department: null,
    clientOrganisation: "Sunrise Events Co",
  },
  opsManagerDaniel: {
    id: "ops-daniel",
    name: "Daniel Okonkwo",
    department: "Event Operations",
    clientOrganisation: null,
  },
  coordinatorAmara: {
    id: "coordinator-nadia",
    name: "Nadia",
    department: "Event Coordination",
    clientOrganisation: null,
  },
  coordinatorJonas: {
    id: "coordinator-omar",
    name: "Omar",
    department: "Event Coordination",
    clientOrganisation: null,
  },
  venueMei: {
    id: "venue-mei",
    name: "Mei Chen",
    department: "Venue Operations",
    clientOrganisation: null,
  },
  technicalRavi: {
    id: "technical-ravi",
    name: "Ravi Kulkarni",
    department: "Technical Support",
    clientOrganisation: null,
  },
} as const satisfies Record<string, Person>;

/** Who the demo role switcher is acting as, per role. */
export const ACTING_AS: Record<string, Person> = {
  requester: PEOPLE.organiserPriya,
  ops: PEOPLE.opsManagerDaniel,
  coordinator: PEOPLE.coordinatorAmara,
  venue: PEOPLE.venueMei,
  technical: PEOPLE.technicalRavi,
};

// --- Venues ----------------------------------------------------------------

export const VENUES: readonly VenueRecord[] = [
  {
    id: "v-01",
    location: "Innovation Suite, 81 Victoria Street",
    capacity: 120,
    facilities: "Projector, PA system, hearing loop, breakout corner",
    accessibility: "Step-free access, accessible WC on level",
    operatingHours: "08:00 - 22:00",
    setupTimeMinutes: 45,
    turnaroundTimeMinutes: 30,
    supportedLayouts: [
      { name: "Theatre", capacity: 120 },
      { name: "Cabaret", capacity: 80 },
      { name: "Boardroom", capacity: 30 },
    ],
  },
  {
    id: "v-02",
    location: "Hall A, 60 Stamford Road",
    capacity: 300,
    facilities: "Stage, dual projection, green room, loading bay",
    accessibility: "Step-free access, accessible stage lift",
    operatingHours: "07:00 - 23:00",
    setupTimeMinutes: 90,
    turnaroundTimeMinutes: 60,
    supportedLayouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Banquet", capacity: 180 },
    ],
  },
  {
    id: "v-03",
    location: "Seminar Room 3, 40 Prinsep Street",
    capacity: 45,
    facilities: "Wall-mounted display, whiteboard",
    accessibility: "Lift access only, no hearing loop",
    operatingHours: "08:00 - 20:00",
    setupTimeMinutes: 20,
    turnaroundTimeMinutes: 15,
    supportedLayouts: [
      { name: "Classroom", capacity: 45 },
      { name: "U-shape", capacity: 24 },
    ],
  },
];

export const EQUIPMENT_CATALOGUE = [
  { type: "Projector (4K)", quantity: 6, location: "Store A" },
  { type: "Wireless microphone", quantity: 24, location: "Store A" },
  { type: "Video-conferencing kit", quantity: 3, location: "Store B" },
  { type: "Laptop (presenter)", quantity: 8, location: "Store B" },
  { type: "Stage lighting rig", quantity: 2, location: "Loading bay" },
] as const;

// --- Request builder -------------------------------------------------------

function request(
  overrides: Partial<EventRequestRecord> &
    Pick<EventRequestRecord, "id" | "eventName" | "status">,
): EventRequestRecord {
  return {
    description: null,
    purpose: null,
    categoryType: "Conference",
    preferredDate: "2026-11-18",
    preferredTime: "09:00 - 17:00",
    expectedAttendance: 90,
    venueRequirements: null,
    accessibilityNeeds: null,
    equipmentRequirements: null,
    registrationRequirements: null,
    roomLayoutPreferences: "Theatre",
    generalProgramme: null,
    otherSpecialArrangements: null,
    decisionRecord: null,
    requestedBy: PEOPLE.organiserPriya,
    assignedCoordinator: null,
    clientOrganisation: "Sunrise Events Co",
    submittedAt: null,
    updatedAt: "2026-09-08",
    ...overrides,
  };
}

// --- Bookings, equipment, support -----------------------------------------

const BOOKING_CONFIRMED: BookingRecord = {
  id: "b-01",
  eventId: "e-06",
  venue: VENUES[0],
  status: "Confirmed",
  slotDate: "2026-10-14",
  slots: ["AM", "PM"],
  requestedBy: PEOPLE.coordinatorAmara,
  decidedBy: PEOPLE.venueMei,
  rejectionNote: null,
  suggestedAlternativeVenue: null,
  requestedAt: "2026-09-01",
};

const BOOKING_REQUESTED: BookingRecord = {
  id: "b-02",
  eventId: "e-04",
  venue: VENUES[1],
  status: "Requested",
  slotDate: "2026-11-18",
  slots: ["AM", "PM"],
  requestedBy: PEOPLE.coordinatorAmara,
  decidedBy: null,
  rejectionNote: null,
  suggestedAlternativeVenue: null,
  requestedAt: "2026-09-07",
};

const BOOKING_REJECTED: BookingRecord = {
  id: "b-03",
  eventId: "e-05",
  venue: VENUES[1],
  status: "Rejected",
  slotDate: "2026-10-02",
  slots: ["PM"],
  requestedBy: PEOPLE.coordinatorJonas,
  decidedBy: PEOPLE.venueMei,
  rejectionNote:
    "Hall A is committed to a contracted client for the whole of 2 October. Loading bay is also closed for resurfacing that week.",
  suggestedAlternativeVenue: "Innovation Suite, 81 Victoria Street",
  requestedAt: "2026-09-03",
};

const BOOKING_PENDING_SMALL: BookingRecord = {
  id: "b-04",
  eventId: "e-07",
  venue: VENUES[2],
  status: "Requested",
  slotDate: "2026-12-03",
  slots: ["AM"],
  requestedBy: PEOPLE.coordinatorJonas,
  decidedBy: null,
  rejectionNote: null,
  suggestedAlternativeVenue: null,
  requestedAt: "2026-09-08",
};

const EQUIPMENT_RESERVED: EquipmentReservationRecord = {
  id: "er-01",
  eventId: "e-06",
  status: "Reserved",
  returnDate: "2026-10-15",
  reviewedBy: PEOPLE.technicalRavi,
  lines: [
    {
      id: "erl-01",
      type: "Projector (4K)",
      quantityRequested: 2,
      quantityReserved: 2,
      quantityAvailable: 6,
      fulfilmentStatus: "Fulfilled",
      operationalStatus: "Reserved",
      defectNotes: null,
    },
    {
      id: "erl-02",
      type: "Wireless microphone",
      quantityRequested: 6,
      quantityReserved: 6,
      quantityAvailable: 24,
      fulfilmentStatus: "Fulfilled",
      operationalStatus: "Reserved",
      defectNotes: null,
    },
  ],
};

/** Partial fulfilment is a first-class state, not a binary flag (#90). */
const EQUIPMENT_PARTIAL: EquipmentReservationRecord = {
  id: "er-02",
  eventId: "e-04",
  status: "Partially Reserved",
  returnDate: "2026-11-19",
  reviewedBy: PEOPLE.technicalRavi,
  lines: [
    {
      id: "erl-03",
      type: "Video-conferencing kit",
      quantityRequested: 4,
      quantityReserved: 3,
      quantityAvailable: 3,
      fulfilmentStatus: "Partially Fulfilled",
      operationalStatus: "Reserved",
      defectNotes: "Only three kits in the pool; a fourth is on order.",
    },
    {
      id: "erl-04",
      type: "Stage lighting rig",
      quantityRequested: 1,
      quantityReserved: 0,
      quantityAvailable: 0,
      fulfilmentStatus: "Unfulfilled",
      operationalStatus: "Maintenance",
      defectNotes: "Both rigs out for inspection until 22 November.",
    },
    {
      id: "erl-05",
      type: "Laptop (presenter)",
      quantityRequested: 2,
      quantityReserved: 2,
      quantityAvailable: 8,
      fulfilmentStatus: "Fulfilled",
      operationalStatus: "Reserved",
      defectNotes: null,
    },
  ],
};

const EQUIPMENT_REQUESTED: EquipmentReservationRecord = {
  id: "er-03",
  eventId: "e-07",
  status: "Requested",
  returnDate: null,
  reviewedBy: null,
  lines: [
    {
      id: "erl-06",
      type: "Projector (4K)",
      quantityRequested: 1,
      quantityReserved: 0,
      quantityAvailable: 6,
      fulfilmentStatus: "Pending",
      operationalStatus: "Available",
      defectNotes: null,
    },
    {
      id: "erl-07",
      type: "Wireless microphone",
      quantityRequested: 2,
      quantityReserved: 0,
      quantityAvailable: 24,
      fulfilmentStatus: "Pending",
      operationalStatus: "Available",
      defectNotes: null,
    },
  ],
};

const SUPPORT_CONFIRMED: SupportRequestRecord = {
  id: "sr-01",
  eventId: "e-06",
  supportNeeded: true,
  description: "Sound check and on-site AV cover for the keynote.",
  timing: "On site from 08:00, cover until 12:30",
  clarificationLog: null,
  response: "Ravi Kulkarni assigned; sound check booked for 08:15.",
  assignedStaff: [PEOPLE.technicalRavi],
};

const SUPPORT_OPEN: SupportRequestRecord = {
  id: "sr-02",
  eventId: "e-04",
  supportNeeded: true,
  description:
    "Hybrid delivery -- remote speakers dialling in for two of the four sessions.",
  timing: "Full day, 08:00 - 18:00",
  clarificationLog:
    "Asked the coordinator whether remote speakers need interpretation. Awaiting the organiser's answer.",
  response: null,
  assignedStaff: [],
};

// --- Events ----------------------------------------------------------------

function event(
  overrides: Partial<EventRecord> &
    Pick<EventRecord, "id" | "name" | "status" | "request">,
): EventRecord {
  return {
    startTime: null,
    endTime: null,
    eventCapacity: null,
    programmeAgenda: null,
    operationalNotes: null,
    registrationEnabled: false,
    registrationOpenDate: null,
    registrationCloseDate: null,
    coordinator: null,
    booking: null,
    equipment: null,
    support: null,
    arrangements: [],
    registrations: [],
    ...overrides,
  };
}

export const EVENTS: readonly EventRecord[] = [
  // 1. Draft -- the organiser is still writing it. Step 1.
  event({
    id: "e-01",
    name: "Q1 Partner Briefing",
    status: "Planning",
    request: request({
      id: "r-01",
      eventName: "Q1 Partner Briefing",
      status: "Draft",
      categoryType: "Seminar",
      description: "Half-day briefing for channel partners on the Q1 roadmap.",
      purpose: null,
      preferredDate: "2027-01-22",
      expectedAttendance: null,
      venueRequirements: "Somewhere central, ideally near an MRT line.",
      updatedAt: "2026-09-08",
    }),
  }),

  // 2. Draft with almost nothing filled in -- shows the empty-ish draft case.
  event({
    id: "e-02",
    name: "Untitled event request",
    status: "Planning",
    request: request({
      id: "r-02",
      eventName: "Untitled event request",
      status: "Draft",
      categoryType: null,
      preferredDate: null,
      preferredTime: null,
      expectedAttendance: null,
      roomLayoutPreferences: null,
      requestedBy: PEOPLE.organiserWeiLin,
      updatedAt: "2026-09-09",
    }),
  }),

  // 3. Submitted, no coordinator yet -- this is the ops manager's queue. Step 3.
  event({
    id: "e-03",
    name: "Annual Client Forum",
    status: "Planning",
    request: request({
      id: "r-03",
      eventName: "Annual Client Forum",
      status: "Submitted",
      categoryType: "Conference",
      description:
        "Full-day forum with a keynote, three breakout tracks and a networking reception.",
      purpose: "Retain top-tier clients and preview next year's product line.",
      preferredDate: "2026-12-10",
      preferredTime: "09:00 - 18:00",
      expectedAttendance: 240,
      venueRequirements:
        "Large hall with a stage, plus three breakout rooms on the same level.",
      accessibilityNeeds: "Step-free throughout; hearing loop in the main hall.",
      equipmentRequirements:
        "Stage lighting, dual projection, six wireless microphones.",
      registrationRequirements: "Public registration, capped at 240.",
      roomLayoutPreferences: "Theatre for the keynote, cabaret for breakouts.",
      generalProgramme: "Keynote 09:30, breakouts 11:00 and 14:00, reception 17:00.",
      submittedAt: "2026-09-08",
      updatedAt: "2026-09-08",
    }),
  }),

  // 4. Under Review, coordinator assigned, venue + technical in flight.
  //    Steps 4-8 -- the richest screen.
  event({
    id: "e-04",
    name: "Hybrid Leadership Summit",
    status: "Planning",
    coordinator: PEOPLE.coordinatorAmara,
    startTime: "2026-11-18T09:00",
    endTime: "2026-11-18T17:00",
    eventCapacity: 180,
    programmeAgenda:
      "Four sessions across the day; two with remote speakers dialling in.",
    booking: BOOKING_REQUESTED,
    equipment: EQUIPMENT_PARTIAL,
    support: SUPPORT_OPEN,
    request: request({
      id: "r-04",
      eventName: "Hybrid Leadership Summit",
      status: "Under Review",
      categoryType: "Conference",
      description:
        "Leadership summit delivered in person and streamed to regional offices.",
      purpose: "Align regional leadership on the three-year strategy.",
      preferredDate: "2026-11-18",
      preferredTime: "09:00 - 17:00",
      expectedAttendance: 180,
      venueRequirements: "Main hall with stage and reliable upstream bandwidth.",
      accessibilityNeeds: "Step-free access; live captions for the streamed sessions.",
      equipmentRequirements:
        "Four video-conferencing kits, a stage lighting rig, two presenter laptops.",
      registrationRequirements: "Invite-only; no public registration.",
      roomLayoutPreferences: "Theatre",
      generalProgramme: "Sessions at 09:30, 11:15, 14:00 and 15:45.",
      otherSpecialArrangements: "Green room for remote speaker handover.",
      assignedCoordinator: PEOPLE.coordinatorAmara,
      submittedAt: "2026-09-02",
      updatedAt: "2026-09-07",
    }),
    arrangements: [
      {
        type: "venue",
        label: "Venue booked",
        essential: true,
        complete: false,
        detail: "Booking b-02 is still Requested -- Hall A has not decided.",
      },
      {
        type: "equipment",
        label: "Equipment reserved",
        essential: true,
        complete: false,
        detail: "Partially Reserved: lighting rig unfulfilled, one VC kit short.",
      },
      {
        type: "technical_support",
        label: "Technical support assigned",
        essential: true,
        complete: false,
        detail: "No staff assigned; a clarification is outstanding.",
      },
      {
        type: "programme",
        label: "Programme agreed",
        essential: true,
        complete: true,
        detail: "Four sessions confirmed with the organiser.",
      },
      {
        type: "registration",
        label: "Registration set up",
        essential: false,
        complete: false,
        detail: "Invite-only -- not applicable to this event.",
      },
    ],
  }),

  // 5. Blocked -- the venue said no. Shows the confirmation gate failing.
  event({
    id: "e-05",
    name: "Graduate Recruitment Open Day",
    status: "Blocked",
    coordinator: PEOPLE.coordinatorJonas,
    startTime: "2026-10-02T13:00",
    endTime: "2026-10-02T18:00",
    eventCapacity: 250,
    booking: BOOKING_REJECTED,
    request: request({
      id: "r-05",
      eventName: "Graduate Recruitment Open Day",
      status: "Approved",
      categoryType: "Exhibition",
      description: "Booth-based open day for final-year students.",
      purpose: "Fill the 2027 graduate intake.",
      preferredDate: "2026-10-02",
      preferredTime: "13:00 - 18:00",
      expectedAttendance: 250,
      venueRequirements: "Large open floor for 20 booths, plus a loading bay.",
      accessibilityNeeds: "Step-free access to every booth.",
      equipmentRequirements: "Booth power and lighting.",
      roomLayoutPreferences: "Exhibition floor",
      decisionRecord:
        "Approved 4 September -- information sufficient for planning to proceed.",
      requestedBy: PEOPLE.organiserWeiLin,
      assignedCoordinator: PEOPLE.coordinatorJonas,
      submittedAt: "2026-08-29",
      updatedAt: "2026-09-04",
    }),
    arrangements: [
      {
        type: "venue",
        label: "Venue booked",
        essential: true,
        complete: false,
        detail: "Hall A rejected the booking. An alternative was suggested.",
      },
      {
        type: "equipment",
        label: "Equipment reserved",
        essential: true,
        complete: false,
        detail: "Cannot reserve booth power until the venue is settled.",
      },
      {
        type: "programme",
        label: "Programme agreed",
        essential: false,
        complete: true,
        detail: "Open-floor format; no timed programme needed.",
      },
    ],
  }),

  // 6. Confirmed with registration open -- the happy path end state. Steps 10-11.
  event({
    id: "e-06",
    name: "Autumn Product Showcase",
    status: "Confirmed",
    coordinator: PEOPLE.coordinatorAmara,
    startTime: "2026-10-14T10:00",
    endTime: "2026-10-14T17:00",
    eventCapacity: 120,
    programmeAgenda: "Keynote at 10:30, demo stations from 13:00.",
    registrationEnabled: true,
    registrationOpenDate: "2026-09-01",
    registrationCloseDate: "2026-10-10",
    booking: BOOKING_CONFIRMED,
    equipment: EQUIPMENT_RESERVED,
    support: SUPPORT_CONFIRMED,
    request: request({
      id: "r-06",
      eventName: "Autumn Product Showcase",
      status: "Approved",
      categoryType: "Exhibition",
      description: "Customer-facing showcase of the autumn release.",
      purpose: "Drive upgrade interest ahead of renewal season.",
      preferredDate: "2026-10-14",
      preferredTime: "10:00 - 17:00",
      expectedAttendance: 110,
      venueRequirements: "Room for 120 theatre-style plus demo stations.",
      accessibilityNeeds: "Step-free access; hearing loop for the keynote.",
      equipmentRequirements: "Two projectors, six wireless microphones.",
      registrationRequirements: "Public registration, capped at venue capacity.",
      roomLayoutPreferences: "Theatre",
      decisionRecord: "Approved 20 August. Confirmed 1 September once venue, equipment and support were all in place.",
      assignedCoordinator: PEOPLE.coordinatorAmara,
      submittedAt: "2026-08-18",
      updatedAt: "2026-09-01",
    }),
    arrangements: [
      {
        type: "venue",
        label: "Venue booked",
        essential: true,
        complete: true,
        detail: "Innovation Suite confirmed for 14 October, AM + PM.",
      },
      {
        type: "equipment",
        label: "Equipment reserved",
        essential: true,
        complete: true,
        detail: "All lines fulfilled.",
      },
      {
        type: "technical_support",
        label: "Technical support assigned",
        essential: true,
        complete: true,
        detail: "Ravi Kulkarni on site from 08:00.",
      },
      {
        type: "programme",
        label: "Programme agreed",
        essential: true,
        complete: true,
        detail: "Keynote and demo schedule signed off.",
      },
      {
        type: "registration",
        label: "Registration set up",
        essential: true,
        complete: true,
        detail: "Open 1 September to 10 October, capped at 120.",
      },
      {
        type: "other",
        label: "Catering ordered",
        essential: false,
        complete: false,
        detail:
          "Not essential -- the event can be confirmed with this outstanding.",
      },
    ],
    registrations: [
      {
        id: "reg-01",
        attendeeName: "Nadia Haddad",
        attendeeEmail: "nadia.haddad@example.com",
        status: "Registered",
        registeredAt: "2026-09-02",
      },
      {
        id: "reg-02",
        attendeeName: "Samuel Ofori",
        attendeeEmail: "samuel.ofori@example.com",
        status: "Registered",
        registeredAt: "2026-09-03",
      },
      {
        id: "reg-03",
        attendeeName: "Grace Lim",
        attendeeEmail: "grace.lim@example.com",
        status: "Withdrawn",
        registeredAt: "2026-09-03",
      },
      {
        id: "reg-04",
        attendeeName: "Tomas Novak",
        attendeeEmail: "tomas.novak@example.com",
        status: "Registered",
        registeredAt: "2026-09-05",
      },
    ],
  }),

  // 7. Approved, planning just started -- venue and equipment both pending.
  event({
    id: "e-07",
    name: "Compliance Training Workshop",
    status: "Planning",
    coordinator: PEOPLE.coordinatorJonas,
    startTime: "2026-12-03T09:00",
    endTime: "2026-12-03T12:30",
    eventCapacity: 40,
    booking: BOOKING_PENDING_SMALL,
    equipment: EQUIPMENT_REQUESTED,
    request: request({
      id: "r-07",
      eventName: "Compliance Training Workshop",
      status: "Approved",
      categoryType: "Training session",
      description: "Mandatory annual compliance refresher.",
      purpose: "Meet the December training deadline.",
      preferredDate: "2026-12-03",
      preferredTime: "09:00 - 12:30",
      expectedAttendance: 38,
      venueRequirements: "Classroom for 40 with a display.",
      equipmentRequirements: "One projector, two microphones.",
      registrationRequirements: "Internal only; attendance tracked off-system.",
      roomLayoutPreferences: "Classroom",
      decisionRecord: "Approved 6 September.",
      requestedBy: PEOPLE.organiserWeiLin,
      assignedCoordinator: PEOPLE.coordinatorJonas,
      submittedAt: "2026-09-05",
      updatedAt: "2026-09-06",
    }),
    arrangements: [
      {
        type: "venue",
        label: "Venue booked",
        essential: true,
        complete: false,
        detail: "Seminar Room 3 requested, awaiting a decision.",
      },
      {
        type: "equipment",
        label: "Equipment reserved",
        essential: true,
        complete: false,
        detail: "Requested, not yet reviewed by technical support.",
      },
      {
        type: "registration",
        label: "Registration set up",
        essential: false,
        complete: false,
        detail: "Internal only -- no attendee registration.",
      },
    ],
  }),

  // 8. Completed -- the far end of the lifecycle. Step 14.
  event({
    id: "e-08",
    name: "Summer Networking Evening",
    status: "Completed",
    coordinator: PEOPLE.coordinatorAmara,
    startTime: "2026-07-24T18:00",
    endTime: "2026-07-24T21:00",
    eventCapacity: 80,
    registrationEnabled: true,
    registrationOpenDate: "2026-06-15",
    registrationCloseDate: "2026-07-20",
    operationalNotes:
      "72 of 80 places taken, 64 attended. PA system cut out briefly at 19:20 -- spare mic used. No damage reported.",
    request: request({
      id: "r-08",
      eventName: "Summer Networking Evening",
      status: "Approved",
      categoryType: "Networking event",
      description: "Informal evening reception for clients and partners.",
      preferredDate: "2026-07-24",
      preferredTime: "18:00 - 21:00",
      expectedAttendance: 80,
      decisionRecord: "Approved 12 June. Completed 25 July.",
      assignedCoordinator: PEOPLE.coordinatorAmara,
      submittedAt: "2026-06-08",
      updatedAt: "2026-07-25",
    }),
    arrangements: [
      {
        type: "venue",
        label: "Venue booked",
        essential: true,
        complete: true,
        detail: "Innovation Suite, evening slot.",
      },
      {
        type: "registration",
        label: "Registration set up",
        essential: true,
        complete: true,
        detail: "Closed 20 July with 72 registrations.",
      },
    ],
  }),
];
