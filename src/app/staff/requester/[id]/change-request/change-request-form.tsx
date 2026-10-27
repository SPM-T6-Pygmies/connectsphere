"use client";

import { CircleAlert, PlusIcon, Trash2Icon } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeRequestField, RequestedChange } from "@/core/domain/change-request";
import type { TimeRangeOnDate } from "@/core/domain/event-times";

import { TimePicker } from "../../../time-picker";
import { submitChangeRequestAction, type SubmitChangeRequestState } from "./actions";

const INITIAL: SubmitChangeRequestState = { status: "idle" };

/** What the form posts: a change, except that a blank attendance box is null. */
type ChangeInput =
  | Exclude<RequestedChange, { field: "expected_attendance" }>
  | { field: "expected_attendance"; value: number | null };

const LABELS: Record<ChangeRequestField, { title: string; description: string }> = {
  times: { title: "Date and times", description: "Every date the event runs on, with its start and end time." },
  venue_requirements: { title: "Venue requirements", description: "What the venue needs to have or allow." },
  expected_attendance: { title: "Expected attendance", description: "How many people you now expect." },
  equipment_requirements: { title: "Equipment requirements", description: "What equipment the event needs." },
  registration: { title: "Registration", description: "Whether attendees register, and when they can." },
};

interface Values {
  times: TimeRangeOnDate[];
  venueRequirements: string;
  expectedAttendance: string;
  equipmentRequirements: string;
  equipmentNotApplicable: boolean;
  registrationEnabled: boolean;
  registrationOpensOn: string;
  registrationClosesOn: string;
  registrationNotApplicable: boolean;
}

/** The ticked fields as the changes the action reads. Whether they make sense is the core's call. */
function toChanges(ticked: ReadonlySet<ChangeRequestField>, values: Values): ChangeInput[] {
  const changes: ChangeInput[] = [];
  if (ticked.has("times")) {
    changes.push({ field: "times", value: values.times });
  }
  if (ticked.has("venue_requirements")) {
    changes.push({ field: "venue_requirements", value: values.venueRequirements });
  }
  if (ticked.has("expected_attendance")) {
    // An empty box posts as null, which the schema reads as no number for the core to refuse.
    changes.push({
      field: "expected_attendance",
      value: values.expectedAttendance.trim() === "" ? null : Number(values.expectedAttendance),
    });
  }
  if (ticked.has("equipment_requirements")) {
    changes.push({
      field: "equipment_requirements",
      value: values.equipmentNotApplicable ? null : values.equipmentRequirements,
    });
  }
  if (ticked.has("registration")) {
    changes.push({
      field: "registration",
      value: values.registrationNotApplicable
        ? null
        : {
            enabled: values.registrationEnabled,
            opensOn: values.registrationOpensOn || null,
            closesOn: values.registrationClosesOn || null,
          },
    });
  }
  return changes;
}

/**
 * SPM-52: one change request, covering whichever significant fields the
 * Organiser ticks (#104). Programme, agenda and other details are not offered
 * (#4). Submitted by hand rather than through `action`, as the new-request
 * form is, so a refused submit does not blank the time pickers.
 */
export function ChangeRequestForm({
  eventRequestId,
  currentTimes,
}: {
  eventRequestId: string;
  /** The event's times now, as a starting point for the new ones. */
  currentTimes: readonly TimeRangeOnDate[];
}) {
  const [state, formAction, pending] = useActionState(submitChangeRequestAction, INITIAL);
  const [ticked, setTicked] = useState<ReadonlySet<ChangeRequestField>>(new Set());
  const [values, setValues] = useState<Values>({
    times: currentTimes.length > 0 ? [...currentTimes] : [{ date: "", start: "", end: "" }],
    venueRequirements: "",
    expectedAttendance: "",
    equipmentRequirements: "",
    equipmentNotApplicable: false,
    registrationEnabled: true,
    registrationOpensOn: "",
    registrationClosesOn: "",
    registrationNotApplicable: false,
  });

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function setTime(index: number, part: keyof TimeRangeOnDate, value: string) {
    set(
      "times",
      values.times.map((range, at) => (at === index ? { ...range, [part]: value } : range)),
    );
  }

  function toggle(field: ChangeRequestField, on: boolean) {
    setTicked((previous) => {
      const next = new Set(previous);
      if (on) {
        next.add(field);
      } else {
        next.delete(field);
      }
      return next;
    });
  }

  const errorField = state.status === "error" ? state.field : null;

  function section(field: ChangeRequestField, body: React.ReactNode) {
    const on = ticked.has(field);
    return (
      <Card key={field} aria-invalid={errorField === field}>
        <CardHeader>
          <CardTitle>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={on}
                onChange={(event) => toggle(field, event.target.checked)}
              />
              {LABELS[field].title}
            </label>
          </CardTitle>
          <CardDescription>{LABELS[field].description}</CardDescription>
        </CardHeader>
        {on && <CardContent className="space-y-3">{body}</CardContent>}
      </Card>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("eventRequestId", eventRequestId);
        formData.set("changes", JSON.stringify(toChanges(ticked, values)));
        startTransition(() => formAction(formData));
      }}
      className="space-y-4"
    >
      {state.status === "error" && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      )}

      {section(
        "times",
        <>
          {values.times.map((range, index) => (
            <div key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor={`date-${index}`}>Date</Label>
                <Input
                  id={`date-${index}`}
                  type="date"
                  value={range.date}
                  onChange={(event) => setTime(index, "date", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`start-${index}`}>Start time</Label>
                <TimePicker
                  id={`start-${index}`}
                  name={`start-${index}`}
                  label="Start time"
                  value={range.start}
                  onChange={(value) => setTime(index, "start", value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`end-${index}`}>End time</Label>
                <TimePicker
                  id={`end-${index}`}
                  name={`end-${index}`}
                  label="End time"
                  endOfDay
                  value={range.end}
                  onChange={(value) => setTime(index, "end", value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove this date"
                disabled={values.times.length === 1}
                onClick={() => set("times", values.times.filter((_, at) => at !== index))}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set("times", [...values.times, { date: "", start: "", end: "" }])}
          >
            <PlusIcon /> Add a date
          </Button>
        </>,
      )}

      {section(
        "venue_requirements",
        <Textarea
          aria-label="New venue requirements"
          value={values.venueRequirements}
          onChange={(event) => set("venueRequirements", event.target.value)}
        />,
      )}

      {section(
        "expected_attendance",
        <Input
          aria-label="New expected attendance"
          type="number"
          min={0}
          step={1}
          value={values.expectedAttendance}
          onChange={(event) => set("expectedAttendance", event.target.value)}
        />,
      )}

      {section(
        "equipment_requirements",
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={values.equipmentNotApplicable}
              onChange={(event) => set("equipmentNotApplicable", event.target.checked)}
            />
            Not applicable — the event needs no equipment
          </label>
          {!values.equipmentNotApplicable && (
            <Textarea
              aria-label="New equipment requirements"
              value={values.equipmentRequirements}
              onChange={(event) => set("equipmentRequirements", event.target.value)}
            />
          )}
        </>,
      )}

      {section(
        "registration",
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={values.registrationNotApplicable}
              onChange={(event) => set("registrationNotApplicable", event.target.checked)}
            />
            Not applicable — a closed-door or invite-only event with no registration
          </label>
          {!values.registrationNotApplicable && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={values.registrationEnabled}
                  onChange={(event) => set("registrationEnabled", event.target.checked)}
                />
                Attendees register for this event
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="registrationOpensOn">Opens on</Label>
                  <Input
                    id="registrationOpensOn"
                    type="date"
                    value={values.registrationOpensOn}
                    onChange={(event) => set("registrationOpensOn", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="registrationClosesOn">Closes on</Label>
                  <Input
                    id="registrationClosesOn"
                    type="date"
                    value={values.registrationClosesOn}
                    onChange={(event) => set("registrationClosesOn", event.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </>,
      )}

      <Button type="submit" disabled={pending || ticked.size === 0}>
        {pending ? "Submitting…" : "Submit change request"}
      </Button>
    </form>
  );
}
