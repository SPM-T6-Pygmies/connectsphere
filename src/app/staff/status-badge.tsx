import { Badge } from "@/components/ui/badge"
import type {
  BookingStatus,
  EquipmentReservationStatus,
  EventRequestStatus,
  EventStatus,
  FulfilmentStatus,
  RegistrationStatus,
} from "@/lib/wireframe"

type AnyStatus =
  | EventRequestStatus
  | EventStatus
  | BookingStatus
  | EquipmentReservationStatus
  | FulfilmentStatus
  | RegistrationStatus

type Variant = React.ComponentProps<typeof Badge>["variant"]

/**
 * One colour vocabulary across every status set, so a reader learns it once:
 * green means settled and good, amber means in flight or partial, red means
 * refused, grey means not started or finished-and-closed.
 */
const VARIANTS: Record<string, Variant> = {
  // Event request
  Draft: "outline",
  Submitted: "secondary",
  "Under Review": "warning",
  Approved: "success",
  Rejected: "destructive",
  Returned: "warning",
  Withdrawn: "outline",
  // Event
  Planning: "secondary",
  Blocked: "destructive",
  Confirmed: "success",
  Completed: "outline",
  Cancelled: "outline",
  // Booking
  Requested: "warning",
  "Tentative Hold": "warning",
  Released: "outline",
  // Equipment
  Reserved: "success",
  "Partially Reserved": "warning",
  Unavailable: "destructive",
  // "Returned" collides with the event-request status of the same name and
  // takes its amber. Harmless in a wireframe; a real badge would be typed per
  // status set rather than sharing one lookup.
  // Fulfilment
  Pending: "warning",
  Fulfilled: "success",
  "Partially Fulfilled": "warning",
  Unfulfilled: "destructive",
  // Registration
  Registered: "success",
  Waitlisted: "warning",
  Attended: "success",
  "No Show": "outline",
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  return <Badge variant={VARIANTS[status] ?? "secondary"}>{status}</Badge>
}
