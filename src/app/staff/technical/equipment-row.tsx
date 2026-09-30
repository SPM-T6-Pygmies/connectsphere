"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EquipmentCatalogueEntry } from "@/core/use-cases/list-equipment-catalogue";

import { updateEquipmentStockAction, type EquipmentFormState } from "./actions";
import { EQUIPMENT_ROW_COLUMNS } from "./equipment-row-layout";

const INITIAL: EquipmentFormState = { status: "idle" };

/**
 * One catalogue line, with its quantity and location editable in place
 * (SPM-40 AC2). Stacked on a phone, in columns from `sm` up.
 */
export function EquipmentRow({ item }: { item: EquipmentCatalogueEntry }) {
  const [state, formAction, pending] = useActionState(updateEquipmentStockAction, INITIAL);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [location, setLocation] = useState(item.location);

  return (
    <li>
      <form
        action={formAction}
        className={`grid gap-3 py-3 sm:items-start ${EQUIPMENT_ROW_COLUMNS}`}
      >
        <input type="hidden" name="equipmentItemId" value={item.id} />

        <div className="min-w-0 sm:pt-1.5">
          <span className="font-medium">{item.type}</span>
          {item.description ? (
            <span className="text-muted-foreground block text-xs">{item.description}</span>
          ) : null}
        </div>

        <label className="text-muted-foreground grid gap-1 text-xs sm:block">
          <span aria-hidden className="sm:hidden">
            In pool
          </span>
          <Input
            name="quantity"
            inputMode="numeric"
            aria-label={`Quantity of ${item.type}`}
            className="text-foreground sm:w-full"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={pending}
          />
        </label>

        <label className="text-muted-foreground grid gap-1 text-xs sm:block">
          <span aria-hidden className="sm:hidden">
            Location
          </span>
          <Input
            name="location"
            aria-label={`Location of ${item.type}`}
            className="text-foreground"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            disabled={pending}
          />
        </label>

        <div className="flex flex-col items-start gap-1">
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
    </li>
  );
}
