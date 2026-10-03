"use client";

import { CircleAlert, TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  editEquipmentRequirementAction,
  removeEquipmentRequirementAction,
  undoEquipmentRemovalAction,
  type EquipmentFormState,
} from "../../equipment-actions";

const INITIAL: EquipmentFormState = { status: "idle" };

export interface EquipmentLineData {
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly quantityRequested: number;
  readonly quantityReserved: number;
  readonly technicalRequirements: string | null;
  readonly reserved: boolean;
  readonly recheckRequired: boolean;
  readonly removalRequested: boolean;
}

type Mode = "view" | "editing" | "removing";

/**
 * SPM-41: one equipment line, with its edit, remove and undo-removal controls.
 *
 * A change to, or removal of, a reserved line asks Technical Support to
 * re-check it, so the form says so before it is saved (AC12). A line whose
 * removal is pending offers only Undo (AC17): until undone it cannot be
 * edited or removed again, and the domain refuses both.
 */
export function EquipmentLine({
  eventId,
  line,
  editable,
}: {
  eventId: string;
  line: EquipmentLineData;
  /** False on a Completed or Cancelled event, whose lines are read-only (AC13). */
  editable: boolean;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const backToView = () => setMode("view");

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{line.equipmentType}</span>
            {line.reserved ? <Badge variant="success">Reserved</Badge> : null}
            {line.recheckRequired ? <Badge variant="warning">Needs re-check</Badge> : null}
            {line.removalRequested ? <Badge variant="destructive">Removal requested</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            Requested {line.quantityRequested} · Reserved {line.quantityReserved}
          </p>
          {line.technicalRequirements ? (
            <p className="text-sm break-words">{line.technicalRequirements}</p>
          ) : null}
        </div>

        {editable && mode === "view" ? (
          line.removalRequested ? (
            <UndoRemovalForm eventId={eventId} line={line} />
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMode("editing")}>
                Edit
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setMode("removing")}>
                Remove
              </Button>
            </div>
          )
        ) : null}
      </div>

      {mode === "editing" ? <EditForm eventId={eventId} line={line} onDone={backToView} /> : null}
      {mode === "removing" ? <RemoveForm eventId={eventId} line={line} onDone={backToView} /> : null}
    </li>
  );
}

/** Warns, before a reserved line is changed or removed, that Technical Support will re-check it (AC12). */
function RecheckWarning({ children }: { children: string }) {
  return (
    <Alert>
      <TriangleAlert aria-hidden />
      <AlertTitle>Technical Support Staff will be asked to re-check this line</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}

function EditForm({
  eventId,
  line,
  onDone,
}: {
  eventId: string;
  line: EquipmentLineData;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: EquipmentFormState, formData: FormData) => {
      const result = await editEquipmentRequirementAction(previous, formData);
      if (result.status === "saved") {
        onDone();
      }
      return result;
    },
    INITIAL,
  );
  const typed = state.status === "error" ? state : null;
  const quantityId = `quantity-${line.equipmentItemId}`;
  const notesId = `notes-${line.equipmentItemId}`;

  return (
    <form action={formAction} noValidate className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="equipmentItemId" value={line.equipmentItemId} />

      {line.reserved ? (
        <RecheckWarning>
          Equipment is already reserved against it. Saving a change flags it for them, and the
          reserved equipment stays held.
        </RecheckWarning>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={quantityId}>Quantity</Label>
        <Input
          id={quantityId}
          name="quantityRequested"
          inputMode="numeric"
          className="sm:w-32"
          defaultValue={typed?.quantity ?? String(line.quantityRequested)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={notesId}>Technical requirements (optional)</Label>
        <Textarea
          id={notesId}
          name="technicalRequirements"
          defaultValue={typed?.technicalRequirements ?? line.technicalRequirements ?? ""}
          disabled={pending}
        />
      </div>

      {state.status === "error" ? <ErrorAlert message={state.message} /> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Save changes
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RemoveForm({
  eventId,
  line,
  onDone,
}: {
  eventId: string;
  line: EquipmentLineData;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: EquipmentFormState, formData: FormData) => {
      const result = await removeEquipmentRequirementAction(previous, formData);
      if (result.status === "saved") {
        onDone();
      }
      return result;
    },
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="equipmentItemId" value={line.equipmentItemId} />

      {line.reserved ? (
        <RecheckWarning>
          Equipment is reserved against it, so the line is not deleted. It is marked removal
          requested, and the equipment stays held until they release it.
        </RecheckWarning>
      ) : (
        <p className="text-sm">Remove {line.equipmentType} from this event? The line is deleted.</p>
      )}

      {state.status === "error" ? <ErrorAlert message={state.message} /> : null}

      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {line.reserved ? "Request removal" : "Remove line"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function UndoRemovalForm({ eventId, line }: { eventId: string; line: EquipmentLineData }) {
  const [state, formAction, pending] = useActionState(undoEquipmentRemovalAction, INITIAL);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="equipmentItemId" value={line.equipmentItemId} />

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Undo removal
      </Button>

      {state.status === "error" ? <ErrorAlert message={state.message} /> : null}
    </form>
  );
}
