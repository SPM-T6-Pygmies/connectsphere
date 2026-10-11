import { LockIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eventRegistrationEditable } from "@/core/domain/event-registration-settings";
import type { ViewCoordinatorEventResult } from "@/core/use-cases/view-coordinator-event";

import { ArrangementStatus } from "./arrangement-status";
import { RegistrationSettingsForm } from "./registration-settings-form";

/**
 * SPM-285: registration readiness.
 *
 * SPM-25: the event's registration settings -- whether Attendees can register
 * and the window they can do it in -- editable until the event is Completed
 * or Cancelled.
 */
export function RegistrationTab({
  event,
  details,
  readiness,
}: Pick<ViewCoordinatorEventResult, "event" | "details" | "readiness">) {
  const settings = {
    enabled: details.registrationEnabled,
    opensOn: details.registrationOpensOn,
    closesOn: details.registrationClosesOn,
  };
  const editable = eventRegistrationEditable(event.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration</CardTitle>
        <CardDescription className={editable ? undefined : "flex items-center gap-1.5"}>
          {editable ? (
            "Choose whether Attendees can register for this event, and when."
          ) : (
            <>
              <LockIcon className="size-3.5" aria-hidden />A {event.status.toLowerCase()} event&apos;s registration
              settings are read-only.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ArrangementStatus readiness={readiness} type="registration" />

        {editable ? (
          // Keyed on what is stored, so a save the page re-renders with starts the form afresh.
          <RegistrationSettingsForm
            key={`${settings.enabled}|${settings.opensOn}|${settings.closesOn}`}
            eventId={event.id}
            settings={settings}
          />
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs">Registration</dt>
              <dd>{settings.enabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Opens on</dt>
              <dd>{settings.opensOn ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Closes on</dt>
              <dd>{settings.closesOn ?? "—"}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
