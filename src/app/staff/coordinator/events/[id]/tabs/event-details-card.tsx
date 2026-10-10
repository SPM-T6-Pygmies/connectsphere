"use client";

import { CircleAlert, PencilIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrdinaryEventDetails, OrdinaryEventField } from "@/core/domain/event-details-edit";
import { ACCESSIBILITY_OPTIONS, unknownOptions } from "@/core/domain/venue-options";

import { OptionCheckboxes } from "../../../../option-fields";
import { updateEventDetailsAction, type UpdateEventDetailsState } from "../../../actions";

const INITIAL: UpdateEventDetailsState = { status: "idle" };

/** Labels for the read view and the form, in the order both show them. */
const LABELS: Record<Exclude<OrdinaryEventField, "name" | "description">, string> = {
  purpose: "Purpose",
  categoryType: "Category",
  programmeAgenda: "Programme agenda",
  specialArrangements: "Special arrangements",
  accessibilityRequirements: "Accessibility",
  operationalNotes: "Internal notes",
};

type FormValues = Record<OrdinaryEventField, string>;

function toFormValues(details: OrdinaryEventDetails): FormValues {
  return Object.fromEntries(
    Object.entries(details).map(([field, value]) => [field, value ?? ""]),
  ) as FormValues;
}

/**
 * SPM-49: the event's ordinary details, and -- while it is still being planned
 * -- the coordinator's way to change them directly. The server makes every
 * call; the form keeps what was typed when a save is refused.
 */
export function EventDetailsCard({
  eventId,
  details,
  editable,
}: {
  eventId: string;
  details: OrdinaryEventDetails;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FormValues>(() => toFormValues(details));
  const [state, formAction, pending] = useActionState(
    async (previous: UpdateEventDetailsState, formData: FormData) => {
      const next = await updateEventDetailsAction(previous, formData);
      if (next.status === "saved") {
        toast.success(next.changed === 0 ? "Nothing changed." : "Event details saved.");
        setEditing(false);
      }
      return next;
    },
    INITIAL,
  );

  const set = (field: OrdinaryEventField) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>Details</CardTitle>
          {editable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setValues(toFormValues(details));
                setEditing(true);
              }}
            >
              <PencilIcon />
              Edit details
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {details.description ? (
            <p className="text-sm break-words whitespace-pre-line">{details.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm">No description was given.</p>
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((field) => (
              <div key={field}>
                <dt className="text-muted-foreground text-xs">{LABELS[field]}</dt>
                <dd className="break-words whitespace-pre-line">{details[field] ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="space-y-4">
          <input type="hidden" name="eventId" value={eventId} />

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={values.name}
              onChange={(event) => set("name")(event.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={values.description}
              onChange={(event) => set("description")(event.target.value)}
              disabled={pending}
            />
          </div>

          {(["purpose", "categoryType", "programmeAgenda", "specialArrangements", "operationalNotes"] as const).map(
            (field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={field}>{LABELS[field]}</Label>
                {field === "categoryType" ? (
                  <Input
                    id={field}
                    name={field}
                    value={values[field]}
                    onChange={(event) => set(field)(event.target.value)}
                    disabled={pending}
                  />
                ) : (
                  <Textarea
                    id={field}
                    name={field}
                    value={values[field]}
                    onChange={(event) => set(field)(event.target.value)}
                    disabled={pending}
                  />
                )}
              </div>
            ),
          )}

          <div className="space-y-1.5">
            <span className="text-sm font-medium">{LABELS.accessibilityRequirements}</span>
            <OptionCheckboxes
              name="accessibilityRequirements"
              options={ACCESSIBILITY_OPTIONS}
              value={values.accessibilityRequirements}
              onChange={set("accessibilityRequirements")}
              disabled={pending}
            />
            {unknownOptions(details.accessibilityRequirements, ACCESSIBILITY_OPTIONS).length > 0 ? (
              <p className="text-muted-foreground text-xs">
                Currently &ldquo;{details.accessibilityRequirements}&rdquo;, written before the list existed. It
                stays unless you tick something here.
              </p>
            ) : null}
          </div>

          {state.status === "error" ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>{state.message}</AlertTitle>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
