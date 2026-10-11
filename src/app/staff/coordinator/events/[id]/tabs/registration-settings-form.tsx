"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RegistrationSettings } from "@/core/domain/event-registration-settings";

import { setEventRegistrationAction, type SetEventRegistrationState } from "../../../actions";

const INITIAL: SetEventRegistrationState = { status: "idle" };

/**
 * SPM-25: the coordinator turns registration on or off and sets the window
 * Attendees can register in. The server makes every call -- including that
 * enabling needs both dates -- and the form keeps what was typed when a save
 * is refused.
 */
export function RegistrationSettingsForm({
  eventId,
  settings,
}: {
  eventId: string;
  settings: RegistrationSettings;
}) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [opensOn, setOpensOn] = useState(settings.opensOn ?? "");
  const [closesOn, setClosesOn] = useState(settings.closesOn ?? "");
  const [state, formAction, pending] = useActionState(
    async (previous: SetEventRegistrationState, formData: FormData) => {
      const next = await setEventRegistrationAction(previous, formData);
      if (next.status === "saved") {
        toast.success(next.changed ? "Registration settings saved." : "Nothing changed.");
      }
      return next;
    },
    INITIAL,
  );

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="enabled" value={enabled ? "on" : ""} />

      <div className="flex items-center gap-3">
        <Switch
          id="registration-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={pending}
        />
        <Label htmlFor="registration-enabled">Registration enabled</Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="registration-opens-on">Opens on</Label>
          <Input
            id="registration-opens-on"
            name="opensOn"
            type="date"
            value={opensOn}
            onChange={(event) => setOpensOn(event.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="registration-closes-on">Closes on</Label>
          <Input
            id="registration-closes-on"
            name="closesOn"
            type="date"
            value={closesOn}
            onChange={(event) => setClosesOn(event.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Attendees can register only while registration is enabled, the event is confirmed, and today is
        between these dates (both included).
      </p>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save registration settings"}
      </Button>
    </form>
  );
}
