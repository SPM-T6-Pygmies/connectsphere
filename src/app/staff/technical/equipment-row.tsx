"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import type { EquipmentCatalogueEntry } from "@/core/use-cases/list-equipment-catalogue";

import { updateEquipmentStockAction, type EquipmentFormState } from "./actions";

const INITIAL: EquipmentFormState = { status: "idle" };

/**
 * One catalogue line, with its quantity and location editable in place
 * (SPM-40 AC2). The inputs sit in their own cells and belong to the form in
 * the last cell through the `form` attribute -- a `<tr>` cannot be a form.
 */
export function EquipmentRow({ item }: { item: EquipmentCatalogueEntry }) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(updateEquipmentStockAction, INITIAL);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [location, setLocation] = useState(item.location);

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{item.type}</span>
        {item.description ? (
          <span className="text-muted-foreground block text-xs">{item.description}</span>
        ) : null}
      </TableCell>
      <TableCell>
        <Input
          form={formId}
          name="quantity"
          inputMode="numeric"
          aria-label={`Quantity of ${item.type}`}
          className="w-20"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          disabled={pending}
        />
      </TableCell>
      <TableCell>
        <Input
          form={formId}
          name="location"
          aria-label={`Location of ${item.type}`}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          disabled={pending}
        />
      </TableCell>
      <TableCell>
        <form id={formId} action={formAction} className="flex flex-col items-start gap-1">
          <input type="hidden" name="equipmentItemId" value={item.id} />
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
        </form>
      </TableCell>
    </TableRow>
  );
}
