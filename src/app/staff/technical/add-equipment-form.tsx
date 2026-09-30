"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createEquipmentItemAction, type EquipmentFormState } from "./actions";

const INITIAL: EquipmentFormState = { status: "idle" };

function fieldError(state: EquipmentFormState, name: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[name]?.[0] : undefined;
}

/** SPM-40 AC1: type, description, quantity and physical location. */
export function AddEquipmentForm() {
  const [state, formAction, pending] = useActionState(createEquipmentItemAction, INITIAL);

  // A rejected form keeps what was typed; an accepted one starts blank again.
  const kept = state.status === "error" ? (state.values ?? {}) : {};
  const formKey = state.status === "success" ? state.message : "entry";

  return (
    <form
      key={formKey}
      action={formAction}
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Add equipment"
    >
      <div className="space-y-1.5">
        <Label htmlFor="equipment-type">Type</Label>
        <Input
          id="equipment-type"
          name="type"
          defaultValue={kept.type}
          placeholder="e.g. Projector (4K)"
          aria-invalid={fieldError(state, "type") ? true : undefined}
          disabled={pending}
        />
        {fieldError(state, "type") ? (
          <p className="text-destructive text-xs">{fieldError(state, "type")}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="equipment-location">Location</Label>
        <Input
          id="equipment-location"
          name="location"
          defaultValue={kept.location}
          placeholder="e.g. Store A"
          aria-invalid={fieldError(state, "location") ? true : undefined}
          disabled={pending}
        />
        {fieldError(state, "location") ? (
          <p className="text-destructive text-xs">{fieldError(state, "location")}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="equipment-quantity">Quantity</Label>
        <Input
          id="equipment-quantity"
          name="quantity"
          inputMode="numeric"
          defaultValue={kept.quantity}
          placeholder="0"
          aria-invalid={fieldError(state, "quantity") ? true : undefined}
          disabled={pending}
        />
        {fieldError(state, "quantity") ? (
          <p className="text-destructive text-xs">{fieldError(state, "quantity")}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="equipment-description">Description (optional)</Label>
        <Input
          id="equipment-description"
          name="description"
          defaultValue={kept.description}
          disabled={pending}
        />
      </div>

      <div className="space-y-3 sm:col-span-2">
        {state.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>{state.message}</AlertTitle>
          </Alert>
        ) : null}
        {state.status === "success" ? (
          <Alert role="status">
            <CircleCheck aria-hidden />
            <AlertTitle>{state.message}</AlertTitle>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add equipment"}
        </Button>
      </div>
    </form>
  );
}
