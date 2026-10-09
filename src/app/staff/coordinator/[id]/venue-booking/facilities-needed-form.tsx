"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FACILITY_OPTIONS } from "@/core/domain/venue-options";

import { OptionCheckboxes } from "../../../option-fields";
import {
  setEventRequiredFacilitiesAction,
  type SetEventRequiredFacilitiesState,
} from "./actions";

const INITIAL: SetEventRequiredFacilitiesState = { status: "idle" };

/**
 * SPM-247: tick the facilities the event needs, from the same list a venue's
 * facilities come from. The server makes every call; this only keeps the
 * button honest.
 */
export function FacilitiesNeededForm({
  eventId,
  eventRequestId,
  saved,
}: {
  eventId: string;
  eventRequestId: string;
  /** What is stored now, as the facility list's own text; empty when none is needed. */
  saved: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: SetEventRequiredFacilitiesState, formData: FormData) => {
      const next = await setEventRequiredFacilitiesAction(previous, formData);
      if (next.status === "saved") {
        toast.success("Facilities saved.");
      }
      return next;
    },
    INITIAL,
  );
  const [value, setValue] = useState(saved);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventRequestId" value={eventRequestId} />
      <OptionCheckboxes
        name="facilities"
        options={FACILITY_OPTIONS}
        value={value}
        onChange={setValue}
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="sm" disabled={value === saved || pending}>
          {pending ? "Saving…" : "Save facilities"}
        </Button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-xs">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
