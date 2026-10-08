"use client";

import { useActionState, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EquipmentCatalogueEntry } from "@/core/use-cases/list-equipment-catalogue";

import { updateEquipmentStockAction, type EquipmentFormState } from "./actions";

const INITIAL: EquipmentFormState = { status: "idle" };

/**
 * One catalogue item as a card, with how many are owned, where they are kept
 * and how many are out of service editable in place (SPM-40 AC2, SPM-17 AC1),
 * and how many are in service (SPM-17 AC3). After a save that leaves fewer in
 * service than upcoming events hold, it names them (SPM-274 AC7).
 */
export function EquipmentRow({ item }: { item: EquipmentCatalogueEntry }) {
  const [state, formAction, pending] = useActionState(updateEquipmentStockAction, INITIAL);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [location, setLocation] = useState(item.location);
  const [outOfService, setOutOfService] = useState(String(item.outOfService));

  return (
    <li>
      <Card className="h-full gap-0 py-3">
        <CardContent className="px-3">
          <form action={formAction} className="grid gap-2">
            <input type="hidden" name="equipmentItemId" value={item.id} />

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-medium">{item.type}</h4>
                {item.description ? (
                  <p className="text-muted-foreground line-clamp-1 text-xs">{item.description}</p>
                ) : null}
              </div>
              <Badge variant={item.outOfService > 0 ? "warning" : "secondary"} className="shrink-0">
                In service: {item.inService} of {item.quantity}
              </Badge>
            </div>

            <div className="grid grid-cols-[4.5rem_6rem_minmax(0,1fr)] gap-2">
              <label className="text-muted-foreground grid gap-1 text-xs">
                Owned
                <Input
                  name="quantity"
                  inputMode="numeric"
                  aria-label={`Owned ${item.type}`}
                  className="text-foreground h-8"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={pending}
                />
              </label>
              <label className="text-muted-foreground grid gap-1 text-xs">
                Out of service
                <Input
                  name="outOfService"
                  inputMode="numeric"
                  aria-label={`${item.type} out of service`}
                  className="text-foreground h-8"
                  value={outOfService}
                  onChange={(event) => setOutOfService(event.target.value)}
                  disabled={pending}
                />
              </label>
              <label className="text-muted-foreground grid gap-1 text-xs">
                Location
                <Input
                  name="location"
                  aria-label={`Location of ${item.type}`}
                  className="text-foreground h-8"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  disabled={pending}
                />
              </label>
            </div>

            {state.status === "success" && state.overheld && state.overheld.length > 0 ? (
              <Alert variant="warning" className="px-2 py-1.5 text-xs">
                <AlertTitle className="text-xs">Fewer in service than these events hold</AlertTitle>
                <AlertDescription className="text-xs">
                  <ul>
                    {state.overheld.map((event) => (
                      <li key={event.eventId}>
                        {`${event.eventName} (${event.eventDate}): ${event.held} held over its days`}
                        {event.held === event.reserved ? null : ` (${event.reserved} its own)`}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              {state.status === "error" ? (
                <p role="alert" className="text-destructive mr-auto text-xs">
                  {state.message}
                </p>
              ) : null}
              {state.status === "success" ? (
                <p role="status" className="text-muted-foreground mr-auto text-xs">
                  {state.message}
                </p>
              ) : null}
              <Button type="submit" size="sm" variant="outline" className="h-7" disabled={pending}>
                {pending ? "Saving…" : "Update"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </li>
  );
}
