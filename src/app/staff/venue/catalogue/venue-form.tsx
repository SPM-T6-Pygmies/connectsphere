"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exceedsVenueCapacity, STANDARD_LAYOUTS, type Venue } from "@/core/domain/venue";
import {
  ACCESSIBILITY_OPTIONS,
  FACILITY_OPTIONS,
} from "@/core/domain/venue-options";

import { OptionCheckboxes, OptionSelect } from "../../option-fields";
import { TimePicker } from "../../time-picker";
import type { VenueFormState } from "./actions";

const INITIAL: VenueFormState = { status: "idle" };

type LayoutRow = { key: number; name: string; capacity: string };
type WindowRow = { key: number; start: string; end: string };

function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

/** Flags a layout that seats more than the venue as it is typed; the server checks it again. */
function layoutCapacityError(layoutCapacity: string, venueCapacity: string): string | undefined {
  if (!isFilled(layoutCapacity) || !isFilled(venueCapacity)) return undefined;
  return exceedsVenueCapacity(Number(layoutCapacity), Number(venueCapacity))
    ? `Cannot be more than the venue's capacity of ${venueCapacity}.`
    : undefined;
}

/**
 * The venue form for create (SPM-146) and update (SPM-147).
 *
 * Every field is mandatory, so the submit button stays disabled until each one
 * is filled -- the same gate the event request form uses. Whether the values
 * make sense (a capacity above 0, a layout listed twice)
 * is `defineVenue`'s call and comes back as a field error. The one exception
 * is a layout seating more than the venue, flagged as it is typed.
 */
export function VenueForm({
  action,
  venue,
}: {
  action: (previous: VenueFormState, formData: FormData) => Promise<VenueFormState>;
  venue?: Venue;
}) {
  // An update stays on this page, so the save needs its own confirmation. It is
  // shown here, as soon as the save returns: the page remounts this form when the
  // saved record changes, which would discard an effect waiting on `state`.
  const [state, formAction, pending] = useActionState(
    async (previous: VenueFormState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.status === "saved") {
        toast.success("Venue saved.");
      }
      return next;
    },
    INITIAL,
  );

  const [location, setLocation] = useState(venue?.location ?? "");
  const [capacity, setCapacity] = useState(venue?.capacity?.toString() ?? "");
  const [facilities, setFacilities] = useState(venue?.facilities ?? "");
  const [accessibility, setAccessibility] = useState(venue?.accessibility ?? "");
  const [nextWindowKey, setNextWindowKey] = useState(() => (venue?.openingHours.length ?? 0) + 1);
  const [windows, setWindows] = useState<WindowRow[]>(() =>
    venue && venue.openingHours.length > 0
      ? venue.openingHours.map((window, index) => ({ key: index, ...window }))
      : [{ key: 0, start: "", end: "" }],
  );
  const [horizon, setHorizon] = useState(venue?.bookingHorizonDays?.toString() ?? "");
  // SPM-23: defined once, then locked. A locked box is read-only, not disabled, so the venue's own
  // values are still sent back with the rest of the form and the save is not a change.
  const buffersLocked = venue?.setupMinutes != null || venue?.turnaroundMinutes != null;
  const [setup, setSetup] = useState(venue?.setupMinutes?.toString() ?? "");
  const [turnaround, setTurnaround] = useState(venue?.turnaroundMinutes?.toString() ?? "");
  const [nextKey, setNextKey] = useState(() => (venue?.layouts.length ?? 0) + 1);
  const [layouts, setLayouts] = useState<LayoutRow[]>(() =>
    venue && venue.layouts.length > 0
      ? venue.layouts.map((layout, index) => ({
          key: index,
          name: layout.name,
          capacity: layout.capacity.toString(),
        }))
      : [{ key: 0, name: "", capacity: "" }],
  );

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const layoutCapacityErrors = layouts.map(
    (row, index) =>
      errors?.[`layouts.${index}.capacity`] ?? layoutCapacityError(row.capacity, capacity),
  );

  const readyToSubmit =
    [location, capacity, facilities, accessibility, horizon].every(isFilled) &&
    windows.length > 0 &&
    windows.every((window) => isFilled(window.start) && isFilled(window.end)) &&
    layouts.length > 0 &&
    layouts.every(
      (layout) =>
        isFilled(layout.name) &&
        isFilled(layout.capacity) &&
        layoutCapacityError(layout.capacity, capacity) === undefined,
    );

  function updateWindow(key: number, patch: Partial<WindowRow>) {
    setWindows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addWindow() {
    setWindows((current) => [...current, { key: nextWindowKey, start: "", end: "" }]);
    setNextWindowKey((current) => current + 1);
  }

  function removeWindow(key: number) {
    setWindows((current) => current.filter((row) => row.key !== key));
  }

  function updateLayout(key: number, patch: Partial<LayoutRow>) {
    setLayouts((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addLayout() {
    setLayouts((current) => [...current, { key: nextKey, name: "", capacity: "" }]);
    setNextKey((current) => current + 1);
  }

  function removeLayout(key: number) {
    setLayouts((current) => current.filter((row) => row.key !== key));
  }

  return (
    <form
      // Submitted by hand, not through `action`: React resets a form after its
      // action runs, which blanks every select (a layout, an opening time)
      // while the state behind it keeps the value, so a refused save would
      // show fields emptied that are not.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-6"
    >
      {venue ? <input type="hidden" name="venueId" value={venue.id} /> : null}

      {state.status === "error" ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {state.message}
        </p>
      ) : null}

      {!readyToSubmit ? (
        <p className="text-muted-foreground text-sm">
          Fields marked <span className="text-destructive">*</span> are mandatory.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>The venue</CardTitle>
          <CardDescription>Where it is and what it offers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="location" label="Location" required error={errors?.location}>
            <Input
              id="location"
              name="location"
              placeholder="Level 3, Innovation Hall"
              required
              aria-invalid={errors?.location !== undefined}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </Field>
          <Field
            id="capacity"
            label="Capacity"
            required
            hint="The venue's headline capacity. Each layout has its own, below."
            error={errors?.capacity}
          >
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              step={1}
              placeholder="200"
              required
              aria-invalid={errors?.capacity !== undefined}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
          </Field>
          <Field
            id="facilities"
            label="Facilities"
            required
            error={errors?.facilities}
            className="sm:col-span-2"
          >
            <OptionCheckboxes
              name="facilities"
              options={FACILITY_OPTIONS}
              value={facilities}
              onChange={setFacilities}
            />
          </Field>
          <Field
            id="accessibility"
            label="Accessibility"
            required
            error={errors?.accessibility}
            className="sm:col-span-2"
          >
            <OptionCheckboxes
              name="accessibility"
              options={ACCESSIBILITY_OPTIONS}
              value={accessibility}
              onChange={setAccessibility}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>When the venue can be booked.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <p className="text-sm font-medium">
              Opening hours<span className="text-destructive" aria-label="required">*</span>
            </p>
            <p className="text-muted-foreground text-xs">
              The same hours apply every day, Singapore time. Add a window for each period the venue is
              open.
            </p>
            {windows.map((row, index) => (
              <div key={row.key} className="grid items-start gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <Field
                  id={`openingStart-${row.key}`}
                  label="Opens"
                  required
                  error={errors?.[`openingHours.${index}.start`]}
                >
                  <TimePicker
                    id={`openingStart-${row.key}`}
                    name="openingStart"
                    label="Opens"
                    invalid={errors?.[`openingHours.${index}.start`] !== undefined}
                    value={row.start}
                    onChange={(start) => updateWindow(row.key, { start })}
                  />
                </Field>
                <Field
                  id={`openingEnd-${row.key}`}
                  label="Closes"
                  required
                  error={errors?.[`openingHours.${index}.end`]}
                >
                  <TimePicker
                    id={`openingEnd-${row.key}`}
                    name="openingEnd"
                    label="Closes"
                    endOfDay
                    invalid={errors?.[`openingHours.${index}.end`] !== undefined}
                    value={row.end}
                    onChange={(end) => updateWindow(row.key, { end })}
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="sm:mt-[1.625rem]"
                  aria-label={`Remove opening window ${index + 1}`}
                  disabled={windows.length === 1}
                  onClick={() => removeWindow(row.key)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))}

            {errors?.openingHours ? (
              <p className="text-destructive text-xs">{errors.openingHours}</p>
            ) : null}

            <Button type="button" variant="outline" onClick={addWindow}>
              <PlusIcon className="size-4" />
              Add opening window
            </Button>
          </div>
          <Field
            id="bookingHorizonDays"
            label="Booking horizon (days)"
            required
            hint="How many days ahead the venue can be booked."
            error={errors?.bookingHorizonDays}
          >
            <Input
              id="bookingHorizonDays"
              name="bookingHorizonDays"
              type="number"
              min={0}
              step={1}
              placeholder="90"
              required
              aria-invalid={errors?.bookingHorizonDays !== undefined}
              value={horizon}
              onChange={(event) => setHorizon(event.target.value)}
            />
          </Field>
          <Field
            id="setupMinutes"
            label="Setup time (minutes)"
            hint={
              buffersLocked
                ? "Locked: setup and turnaround are set once and cannot be changed."
                : "Time to prepare the room before an event. In 15-minute steps; 0 is allowed. Enter both setup and turnaround, or neither: a venue with neither set counts as 0. Once saved they are locked."
            }
            error={errors?.setupMinutes}
          >
            <Input
              id="setupMinutes"
              name="setupMinutes"
              type="number"
              placeholder="Not set"
              readOnly={buffersLocked}
              aria-readonly={buffersLocked}
              aria-invalid={errors?.setupMinutes !== undefined}
              className={buffersLocked ? "bg-muted text-muted-foreground" : undefined}
              value={setup}
              onChange={(event) => setSetup(event.target.value)}
            />
          </Field>
          <Field
            id="turnaroundMinutes"
            label="Turnaround time (minutes)"
            hint={
              buffersLocked
                ? "Locked."
                : "Time to reset the room after an event. In 15-minute steps; 0 is allowed."
            }
            error={errors?.turnaroundMinutes}
          >
            <Input
              id="turnaroundMinutes"
              name="turnaroundMinutes"
              type="number"
              placeholder="Not set"
              readOnly={buffersLocked}
              aria-readonly={buffersLocked}
              aria-invalid={errors?.turnaroundMinutes !== undefined}
              className={buffersLocked ? "bg-muted text-muted-foreground" : undefined}
              value={turnaround}
              onChange={(event) => setTurnaround(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Room layouts</CardTitle>
          <CardDescription>
            Each layout the venue supports, with the capacity you supply for it. It is not worked
            out for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {layouts.map((row, index) => (
            <div key={row.key} className="grid items-start gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <Field
                id={`layoutName-${row.key}`}
                label="Layout"
                required
                error={errors?.[`layouts.${index}.name`]}
              >
                <OptionSelect
                  id={`layoutName-${row.key}`}
                  name="layoutName"
                  options={STANDARD_LAYOUTS}
                  blank="Select a layout"
                  required
                  aria-invalid={errors?.[`layouts.${index}.name`] !== undefined}
                  value={row.name}
                  onChange={(name) => updateLayout(row.key, { name })}
                />
              </Field>
              <Field
                id={`layoutCapacity-${row.key}`}
                label="Capacity"
                required
                error={layoutCapacityErrors[index]}
              >
                <Input
                  id={`layoutCapacity-${row.key}`}
                  name="layoutCapacity"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="120"
                  required
                  aria-invalid={layoutCapacityErrors[index] !== undefined}
                  value={row.capacity}
                  onChange={(event) => updateLayout(row.key, { capacity: event.target.value })}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="sm:mt-[1.625rem]"
                aria-label={`Remove layout ${index + 1}`}
                disabled={layouts.length === 1}
                onClick={() => removeLayout(row.key)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}

          {errors?.layouts ? <p className="text-destructive text-xs">{errors.layouts}</p> : null}

          <Button type="button" variant="outline" onClick={addLayout}>
            <PlusIcon className="size-4" />
            Add layout
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" asChild type="button">
          <Link href="/staff/venue/catalogue">Cancel</Link>
        </Button>
        <Button type="submit" disabled={!readyToSubmit || pending}>
          {pending ? "Saving…" : venue ? "Save venue" : "Add venue"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  required,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-label="required">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

