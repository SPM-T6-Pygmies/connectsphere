"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { cancelEventAction, type CancelEventState } from "../../actions";

const INITIAL: CancelEventState = { status: "idle" };

/**
 * SPM-55: cancels the event this Coordinator is viewing. Cancelling cannot be
 * undone, so it asks in a dialog before anything is sent.
 *
 * The page renders this only while the event can still be cancelled; the
 * server makes every call. On success the page re-renders as Cancelled,
 * which unmounts this form -- so the confirmation is a toast fired from the
 * action.
 */
export function CancelEventForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [state, formAction, pending] = useActionState(
    async (previous: CancelEventState, formData: FormData) => {
      const next = await cancelEventAction(previous, formData);
      if (next.status === "cancelled") {
        toast.success(`${eventName} cancelled. Its venue bookings have been released.`);
      }
      return next;
    },
    INITIAL,
  );
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          Cancel event
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cancel this event?</SheetTitle>
          <SheetDescription>
            Every venue booking and hold for {eventName} is released, and any venue request still awaiting
            Venue Staff is closed. This cannot be undone.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4 px-4 pb-4">
          <input type="hidden" name="id" value={eventId} />

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
              Keep event
            </Button>
            <Button type="submit" variant="destructive" className="flex-1" disabled={pending}>
              {pending ? "Cancelling…" : "Yes, cancel event"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
