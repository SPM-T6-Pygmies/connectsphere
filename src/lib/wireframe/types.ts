/**
 * Staff-facing view types for the workflow wireframes.
 *
 * Deliberately separate from `src/core/domain`. The core's `Event` is the
 * attendee-facing projection -- internal planning information "never enters
 * this type in the first place" (brief s8b), which is exactly the information
 * these screens exist to show. Widening it to serve a wireframe would undo
 * that boundary.
 *
 * Field names mirror `supabase/schema.sql` column names so that replacing
 * these fixtures with real use cases later is a swap, not a rename.
 */

/** `event_request_status_chk`. */
export type EventRequestStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Returned"
  | "Withdrawn";

/** `event_status_chk`. */
export type EventStatus =
  | "Planning"
  | "Blocked"
  | "Confirmed"
  | "Completed"
  | "Cancelled";

/** `booking_status_chk`. */
export type BookingStatus =
  | "Requested"
  | "Tentative Hold"
  | "Confirmed"
  | "Rejected"
  | "Released"
  | "Cancelled";

/** `booking_slot_value_chk` -- venues book in three fixed slots (#50). */
export type BookingSlot = "AM" | "PM" | "Night";

/** `equipment_reservation_status_chk`. */
export type EquipmentReservationStatus =
  | "Requested"
  | "Reserved"
  | "Partially Reserved"
  | "Unavailable"
  | "Released"
  | "Returned";

/** `equipment_reservation_line_fulfilment_chk` -- judged line by line (#90). */
export type FulfilmentStatus =
  | "Pending"
  | "Fulfilled"
  | "Partially Fulfilled"
  | "Unfulfilled";

/** `equipment_item_operational_status_chk`. */
export type EquipmentOperationalStatus =
  | "Available"
  | "Reserved"
  | "In Use"
  | "Maintenance"
  | "Defective"
  | "Retired";

/** `registration_status_chk`. */
export type RegistrationStatus =
  | "Registered"
  | "Waitlisted"
  | "Cancelled"
  | "Withdrawn"
  | "Attended"
  | "No Show";

/** `event_essential_arrangement_type_chk`. */
export type ArrangementType =
  | "venue"
  | "equipment"
  | "technical_support"
  | "programme"
  | "registration"
  | "other";

/** The five staff personas the wireframes can act as. */
export type StaffRole =
  | "requester"
  | "ops"
  | "coordinator"
  | "venue"
  | "technical";

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly department: string | null;
  readonly clientOrganisation: string | null;
}

export interface EventRequestRecord {
  readonly id: string;
  readonly eventName: string;
  readonly description: string | null;
  readonly purpose: string | null;
  readonly categoryType: string | null;
  readonly preferredDate: string | null;
  readonly preferredTime: string | null;
  readonly expectedAttendance: number | null;
  readonly venueRequirements: string | null;
  readonly accessibilityNeeds: string | null;
  readonly equipmentRequirements: string | null;
  readonly registrationRequirements: string | null;
  readonly roomLayoutPreferences: string | null;
  readonly generalProgramme: string | null;
  readonly otherSpecialArrangements: string | null;
  readonly status: EventRequestStatus;
  readonly decisionRecord: string | null;
  readonly requestedBy: Person;
  readonly assignedCoordinator: Person | null;
  readonly clientOrganisation: string;
  readonly submittedAt: string | null;
  readonly updatedAt: string;
}

export interface VenueRecord {
  readonly id: string;
  readonly location: string;
  readonly capacity: number | null;
  readonly facilities: string | null;
  readonly accessibility: string | null;
  readonly operatingHours: string | null;
  readonly setupTimeMinutes: number | null;
  readonly turnaroundTimeMinutes: number | null;
  readonly supportedLayouts: ReadonlyArray<{
    readonly name: string;
    readonly capacity: number | null;
  }>;
}

export interface BookingRecord {
  readonly id: string;
  readonly eventId: string;
  readonly venue: VenueRecord;
  readonly status: BookingStatus;
  readonly slotDate: string;
  readonly slots: readonly BookingSlot[];
  readonly requestedBy: Person;
  readonly decidedBy: Person | null;
  readonly rejectionNote: string | null;
  readonly suggestedAlternativeVenue: string | null;
  readonly requestedAt: string;
}

export interface EquipmentLine {
  readonly id: string;
  readonly type: string;
  readonly quantityRequested: number;
  readonly quantityReserved: number;
  readonly quantityAvailable: number;
  readonly fulfilmentStatus: FulfilmentStatus;
  readonly operationalStatus: EquipmentOperationalStatus;
  readonly defectNotes: string | null;
}

export interface EquipmentReservationRecord {
  readonly id: string;
  readonly eventId: string;
  readonly status: EquipmentReservationStatus;
  readonly returnDate: string | null;
  readonly reviewedBy: Person | null;
  readonly lines: readonly EquipmentLine[];
}

export interface SupportRequestRecord {
  readonly id: string;
  readonly eventId: string;
  readonly supportNeeded: boolean;
  readonly description: string | null;
  readonly timing: string | null;
  readonly clarificationLog: string | null;
  readonly response: string | null;
  readonly assignedStaff: readonly Person[];
}

/**
 * One row of the confirmation gate (#80).
 *
 * `essential` is per-event, not a fixed list -- some events need no equipment,
 * technical support or registration at all. Confirmation is blocked while any
 * essential row is incomplete.
 */
export interface ArrangementRecord {
  readonly type: ArrangementType;
  readonly label: string;
  readonly essential: boolean;
  readonly complete: boolean;
  readonly detail: string;
}

export interface RegistrationRecord {
  readonly id: string;
  readonly attendeeName: string;
  readonly attendeeEmail: string;
  readonly status: RegistrationStatus;
  readonly registeredAt: string;
}

export interface CommentRecord {
  readonly id: string;
  readonly author: Person;
  readonly body: string;
  readonly createdAt: string;
}

export interface EventRecord {
  readonly id: string;
  readonly request: EventRequestRecord;
  readonly name: string;
  readonly status: EventStatus;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly eventCapacity: number | null;
  readonly programmeAgenda: string | null;
  readonly operationalNotes: string | null;
  readonly registrationEnabled: boolean;
  readonly registrationOpenDate: string | null;
  readonly registrationCloseDate: string | null;
  readonly coordinator: Person | null;
  readonly booking: BookingRecord | null;
  readonly equipment: EquipmentReservationRecord | null;
  readonly support: SupportRequestRecord | null;
  readonly arrangements: readonly ArrangementRecord[];
  readonly registrations: readonly RegistrationRecord[];
  readonly comments: readonly CommentRecord[];
}

/**
 * Which surface an activity entry or comment belongs to.
 *
 * The wiki leaves open "whether every domain object carries its own activity
 * trail, or all entries roll up to the owning event's record". This is the
 * middle: one trail per event, each entry tagged with the surface it happened
 * on, so a venue decision reads on the Venue tab without the event losing a
 * single history.
 */
export type ActivitySection =
  | "overview"
  | "venue"
  | "technical"
  | "readiness"
  | "registration";

interface ActivityBase {
  readonly id: string;
  readonly eventId: string;
  readonly section: ActivitySection;
  readonly actor: Person;
  readonly at: string;
}

/** Something the system recorded: who did what, and when (brief s8f). */
export interface SystemActivity extends ActivityBase {
  readonly kind: "activity";
  readonly action: string;
  /** Present when this is a change rather than an action: the what/from/to. */
  readonly field?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * Something a person said.
 *
 * `parentId` mirrors `event_comment.parent_comment_id`. The customer left
 * threaded-vs-flat open as a UI decision, so one level of reply is a choice,
 * not an assumption -- deeper nesting is not something anyone asked for.
 */
export interface CommentActivity extends ActivityBase {
  readonly kind: "comment";
  readonly body: string;
  readonly parentId: string | null;
}

export type ActivityEntry = SystemActivity | CommentActivity;
