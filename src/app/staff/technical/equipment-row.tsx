"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EquipmentCatalogueEntry } from "@/core/use-cases/list-equipment-catalogue";

import { updateEquipmentStockAction, type EquipmentFormState } from "./actions";

const INITIAL: EquipmentFormState = { status: "idle" };

/**
 * One catalogue item as a card, with its quantity and location editable in
 * place (SPM-40 AC2).
 */
export function EquipmentRow({ item }: { item: EquipmentCatalogueEntry }) {
  const [state, formAction, pending] = useActionState(updateEquipmentStockAction, INITIAL);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [location, setLocation] = useState(item.location);

  return (
    <li>
      <Card className="h-full gap-0 py-4">
        <CardContent className="px-4">
          <form action={formAction} className="grid gap-3">
            <input type="hidden" name="equipmentItemId" value={item.id} />

            <div className="min-w-0">
              <h4 className="font-medium">{item.type}</h4>
              {item.description ? (
                <p className="text-muted-foreground text-xs">{item.description}</p>
              ) : null}
            </div>

            <label className="text-muted-foreground grid gap-1 text-xs">
              Quantity
              <Input
                name="quantity"
                inputMode="numeric"
                aria-label={`Quantity of ${item.type}`}
                className="text-foreground"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={pending}
              />
            </label>

            <label className="text-muted-foreground grid gap-1 text-xs">
              Location
              <Input
                name="location"
                aria-label={`Location of ${item.type}`}
                className="text-foreground"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                disabled={pending}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                {pending ? "Saving…" : "Update"}
              </Button>
              {state.status === "error" ? (
                <p role="alert" className="text-destructive text-xs">
                  {state.message}
                </p>
              ) : null}
              {state.status === "success" ? (
                <p role="status" className="text-muted-foreground text-xs">
                  {state.message}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </li>
  );
}
