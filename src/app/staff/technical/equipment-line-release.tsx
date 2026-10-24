"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { releaseEquipmentLineAction, type EquipmentFormState } from "./actions";

const INITIAL: EquipmentFormState = { status: "idle" };

export interface ReleasableLine {
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly quantityReserved: number;
}

/**
 * SPM-108: release the units held on a line the coordinator asked to remove.
 * The line then goes, which cannot be undone, so the first press asks before
 * anything is sent. Either way the outcome is a toast: on success the row
 * unmounts, and if the coordinator withdrew the removal meanwhile (AC3) the
 * page refreshes to show the line Reserved, which unmounts this form too.
 */
export function EquipmentLineRelease({ eventId, line }: { eventId: string; line: ReleasableLine }) {
  const [, formAction, pending] = useActionState(
    async (previous: EquipmentFormState, formData: FormData) => {
      const next = await releaseEquipmentLineAction(previous, formData);
      if (next.status === "success") {
        toast.success(`${line.quantityReserved} × ${line.equipmentType} released. They are free for other events.`);
      } else if (next.status === "error") {
        toast.error(next.message);
      }
      return next;
    },
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" size="sm" className="h-7" onClick={() => setConfirming(true)}>
        Release {line.quantityReserved}
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-1.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="equipmentItemId" value={line.equipmentItemId} />
      <p className="text-xs">
        Release {line.quantityReserved} × {line.equipmentType}? The line is removed from the event.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" size="sm" className="h-7" disabled={pending}>
          {pending ? "Releasing…" : "Yes, release"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep
        </Button>
      </div>
    </form>
  );
}
