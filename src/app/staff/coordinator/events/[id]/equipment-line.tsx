"use client";

import { CircleAlert, TriangleAlert } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  editEquipmentRequirementAction,
  markEquipmentLineEssentialAction,
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
  readonly underReview: boolean;
  readonly removalRequested: boolean;
  /** SPM-274 AC3. */
  readonly unfulfilled: boolean;
  /** SPM-274 AC1, AC3: who reserved the line or marked it unfulfilled, and why not. */
  readonly decision: { readonly byName: string | null; readonly comment: string | null } | null;
  /** SPM-109. */
  readonly essential: boolean;
}

type Mode = "view" | "editing" | "removing";

/**
 * SPM-41: one equipment line, with its edit, remove and undo-removal controls.
 *
 * A change to, or removal of, a reserved line asks Technical Support to
 * re-check it, so the form says so before it is saved (AC12). A line whose
 * removal is pending offers only Undo (AC17): until undone it cannot be
 * edited or removed again, and the domain refuses both.
 *
 * SPM-274: a reserved line names who reserved it (AC1); an unfulfilled one
 * says why it could not be met and who said so (AC3).
 *
 * SPM-109: the coordinator marks the line essential once they and Technical
 * Support agree it is; on a read-only event the mark is only shown.
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
            {line.essential && !editable ? <Badge variant="secondary">Essential</Badge> : null}
            {line.reserved ? <Badge variant="success">Reserved</Badge> : null}
            {line.unfulfilled ? <Badge variant="destructive">Unfulfilled</Badge> : null}
            {line.underReview ? <Badge variant="warning">Needs re-check</Badge> : null}
            {line.removalRequested ? <Badge variant="destructive">Removal requested</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            Requested {line.quantityRequested} · Reserved {line.quantityReserved}
            {line.reserved && line.decision?.byName ? ` · Reserved by ${line.decision.byName}` : null}
          </p>
          {line.unfulfilled && line.decision !== null ? (
            <p className="text-sm break-words">
              {line.decision.comment}
              {line.decision.byName ? (
                <span className="text-muted-foreground">{` — ${line.decision.byName}, Technical Support`}</span>
              ) : null}
            </p>
          ) : null}
          {line.technicalRequirements ? (
            <p className="text-sm break-words">{line.technicalRequirements}</p>
          ) : null}
          {editable && mode === "view" ? <EssentialToggle eventId={eventId} line={line} /> : null}
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
          Equipment is already reserved against it. Saving a change puts it under review, and
          the reserved equipment stays held.
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
          requested, and the equipment stays held until they release it. Until then you can undo
          the request, which withdraws it.
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

/**
 * SPM-109 AC1-AC2: saves as soon as it is switched. How the coordinator and
 * Technical Support agree happens outside the system; this records the outcome.
 */
function EssentialToggle({ eventId, line }: { eventId: string; line: EquipmentLineData }) {
  const [state, formAction, pending] = useActionState(markEquipmentLineEssentialAction, INITIAL);
  const switchId = `essential-${line.equipmentItemId}`;

  const mark = (essential: boolean) => {
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("equipmentItemId", line.equipmentItemId);
    formData.set("essential", essential ? "on" : "");
    startTransition(() => formAction(formData));
  };

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <Switch id={switchId} size="sm" checked={line.essential} onCheckedChange={mark} disabled={pending} />
        <Label htmlFor={switchId} className="text-sm font-normal">
          Essential
        </Label>
        <span className="text-muted-foreground text-xs">Mark once agreed with Technical Support</span>
      </div>

      {state.status === "error" ? <ErrorAlert message={state.message} /> : null}
    </div>
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
