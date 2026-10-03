"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { addEquipmentRequirementAction, type EquipmentFormState } from "../../equipment-actions";

const INITIAL: EquipmentFormState = { status: "idle" };

/**
 * SPM-41 AC1-AC5: add a line to the event's equipment requirements.
 *
 * `noValidate` leaves the quantity and notes rules to the domain, so the
 * message a coordinator reads is the one every other caller gets. Every
 * catalogue type stays pickable: a type the event already has is refused by
 * the domain with "edit the existing line" (AC2) rather than hidden here.
 */
export function AddEquipmentForm({
  eventId,
  catalogue,
}: {
  eventId: string;
  catalogue: readonly { id: string; type: string }[];
}) {
  const [state, formAction, pending] = useActionState(addEquipmentRequirementAction, INITIAL);
  const typed = state.status === "error" ? state : null;

  return (
    <form action={formAction} noValidate className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="equipmentItemId">Equipment type</Label>
          <select
            id="equipmentItemId"
            name="equipmentItemId"
            defaultValue=""
            disabled={pending}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3"
          >
            <option value="" disabled>
              Choose a type
            </option>
            {catalogue.map((item) => (
              <option key={item.id} value={item.id}>
                {item.type}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quantityRequested">Quantity</Label>
          <Input
            id="quantityRequested"
            name="quantityRequested"
            inputMode="numeric"
            defaultValue={typed?.quantity ?? ""}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="technicalRequirements">Technical requirements (optional)</Label>
        <Textarea
          id="technicalRequirements"
          name="technicalRequirements"
          defaultValue={typed?.technicalRequirements ?? ""}
          aria-describedby="technicalRequirements-hint"
          disabled={pending}
        />
        <p id="technicalRequirements-hint" className="text-muted-foreground text-xs">
          Up to 500 characters.
        </p>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        Add line
      </Button>
    </form>
  );
}
