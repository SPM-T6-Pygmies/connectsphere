import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ViewEventEquipmentResult } from "@/core/use-cases/view-event-equipment";
import { LockIcon } from "lucide-react";

import { AddEquipmentForm } from "./add-equipment-form";
import { EquipmentLine } from "./equipment-line";

/**
 * SPM-41: what equipment this event needs. The coordinator records lines
 * (type, quantity, optional technical requirements) for Technical Support
 * Staff to check and reserve, with the Organiser's own words beside them as
 * context (AC6). A Completed or Cancelled event shows them read-only (AC13).
 */
export function EquipmentSection({ equipment }: { equipment: ViewEventEquipmentResult }) {
  const { event, editable, statedEquipmentNeeds, lines, catalogue } = equipment;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment requirements</CardTitle>
        <CardDescription>
          What Technical Support Staff should check and reserve for this event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-muted-foreground text-xs">Stated by the Organiser</h3>
          {statedEquipmentNeeds ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm break-words whitespace-pre-line">
              {statedEquipmentNeeds}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">The Organiser did not state any equipment needs.</p>
          )}
        </div>

        {editable ? null : (
          <Alert>
            <LockIcon aria-hidden />
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>
              Equipment requirements on a {event.status} event can no longer be changed.
            </AlertDescription>
          </Alert>
        )}

        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">No equipment has been recorded for this event yet.</p>
        ) : (
          <ul className="divide-y">
            {lines.map((line) => (
              <EquipmentLine
                key={line.equipmentItemId}
                eventId={event.id}
                line={line}
                editable={editable}
              />
            ))}
          </ul>
        )}

        {editable ? (
          <div className="space-y-3 border-t pt-5">
            <h3 className="text-sm font-medium">Add equipment</h3>
            <AddEquipmentForm eventId={event.id} catalogue={catalogue} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
