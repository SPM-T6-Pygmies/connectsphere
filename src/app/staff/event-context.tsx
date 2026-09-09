import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EventRecord } from "@/lib/wireframe";

import { FieldList } from "./field-list";
import { StatusBadge } from "./status-badge";

/**
 * The event, as much of it as a venue or technical decision needs.
 *
 * Venue Staff and Technical Support Staff both work a queue of their own
 * records, but neither can decide without the event behind it -- the layout
 * and accessibility needs drive a venue answer, the attendance and timing
 * drive an equipment one. One panel serves both rather than each screen
 * growing its own copy.
 *
 * Deliberately read-only, and deliberately not everything: the decision
 * record and the clarification thread belong to the coordinator.
 */
export function EventContextPanel({ event }: { event: EventRecord }) {
  const request = event.request;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
        <CardDescription>
          {request.clientOrganisation} · organised by {request.requestedBy.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={event.status} />
          <StatusBadge status={request.status} />
        </div>

        <FieldList
          columns={1}
          fields={[
            { label: "Category", value: request.categoryType },
            { label: "Date", value: request.preferredDate },
            { label: "Time", value: request.preferredTime },
            { label: "Expected attendance", value: request.expectedAttendance },
            { label: "Room layout", value: request.roomLayoutPreferences },
            { label: "Accessibility needs", value: request.accessibilityNeeds },
            { label: "Venue requirements", value: request.venueRequirements },
            {
              label: "Equipment requirements",
              value: request.equipmentRequirements,
            },
            { label: "Programme", value: request.generalProgramme },
            {
              label: "Other arrangements",
              value: request.otherSpecialArrangements,
            },
            { label: "Coordinator", value: event.coordinator?.name },
          ]}
        />
      </CardContent>
    </Card>
  );
}
