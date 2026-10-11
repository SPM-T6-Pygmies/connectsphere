"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { completeEventAction, type CompleteEventState } from "../../actions";

const INITIAL: CompleteEventState = { status: "idle" };

/**
 * SPM-51: marks the Confirmed event this Coordinator is viewing as completed,
 * with its operational notes, in a dialog.
 *
 * `canComplete` is the page's read of whether the event has ended -- an error
 * here means the page was stale, not the first the coordinator hears of it.
 * On success the page re-renders as Completed, without this form.
 */
export function CompleteForm({
  eventId,
  canComplete,
  operationalNotes,
}: {
  eventId: string;
  canComplete: boolean;
  operationalNotes: string | null;
}) {
  const [state, formAction, pending] = useActionState(completeEventAction, INITIAL);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            className="w-full"
            disabled={!canComplete}
            aria-describedby={canComplete ? undefined : "complete-event-hint"}
          >
            Mark completed
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Mark event completed</SheetTitle>
            <SheetDescription>
              The event becomes read-only once it is completed. Record anything worth keeping about how it ran.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="space-y-4 px-4 pb-4">
            <input type="hidden" name="id" value={eventId} />

            <div className="space-y-2">
              <Label htmlFor="completion-notes">Operational notes</Label>
              <Textarea
                id="completion-notes"
                name="notes"
                rows={6}
                defaultValue={state.status === "error" ? state.notes : (operationalNotes ?? "")}
                aria-describedby="completion-notes-hint"
                disabled={pending}
              />
              <p id="completion-notes-hint" className="text-muted-foreground text-xs">
                Optional. Left blank, the notes already recorded are kept.
              </p>
            </div>

            {state.status === "error" ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertTitle>{state.message}</AlertTitle>
              </Alert>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={pending}>
                {pending ? "Completing…" : "Mark completed"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {canComplete ? null : (
        <p id="complete-event-hint" className="text-muted-foreground text-xs">
          Available after the event ends.
        </p>
      )}
    </div>
  );
}
