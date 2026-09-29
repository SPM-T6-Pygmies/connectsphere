"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { STANDARD_LAYOUTS, type Venue } from "@/core/domain/venue";

import { TimePicker } from "../../time-picker";
import type { VenueFormState } from "./actions";

const INITIAL: VenueFormState = { status: "idle" };

type LayoutRow = { key: number; name: string; capacity: string };

function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * The venue form for create (SPM-146) and update (SPM-147).
 *
 * Every field is mandatory, so the submit button stays disabled until each one
 * is filled -- the same gate the event request form uses. Whether the values
 * make sense (closing after opening, a capacity above 0, a layout listed twice)
 * is `defineVenue`'s call and comes back as a field error.
 */
export function VenueForm({
  action,
  venue,
}: {
  action: (previous: VenueFormState, formData: FormData) => Promise<VenueFormState>;
  venue?: Venue;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const [location, setLocation] = useState(venue?.location ?? "");
  const [capacity, setCapacity] = useState(venue?.capacity?.toString() ?? "");
  const [facilities, setFacilities] = useState(venue?.facilities ?? "");
  const [accessibility, setAccessibility] = useState(venue?.accessibility ?? "");
  const [opens, setOpens] = useState(venue?.operatingHoursStart ?? "");
  const [closes, setCloses] = useState(venue?.operatingHoursEnd ?? "");
  const [horizon, setHorizon] = useState(venue?.bookingHorizonDays?.toString() ?? "");
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

  // An update stays on this page, so the save needs its own confirmation.
  useEffect(() => {
    if (state.status === "saved") {
      toast.success("Venue saved.");
    }
  }, [state]);

  const errors = state.status === "error" ? state.fieldErrors : undefined;

  const readyToSubmit =
    [location, capacity, facilities, accessibility, opens, closes, horizon].every(isFilled) &&
    layouts.length > 0 &&
    layouts.every((layout) => isFilled(layout.name) && isFilled(layout.capacity));

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
    <form action={formAction} className="space-y-6">
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
            <Textarea
              id="facilities"
              name="facilities"
              placeholder="Projector, PA system, breakout rooms…"
              required
              aria-invalid={errors?.facilities !== undefined}
              value={facilities}
              onChange={(event) => setFacilities(event.target.value)}
            />
          </Field>
          <Field
            id="accessibility"
            label="Accessibility"
            required
            error={errors?.accessibility}
            className="sm:col-span-2"
          >
            <Textarea
              id="accessibility"
              name="accessibility"
              placeholder="Step-free access, hearing loop, accessible toilets…"
              required
              aria-invalid={errors?.accessibility !== undefined}
              value={accessibility}
              onChange={(event) => setAccessibility(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>When the venue can be booked.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="operatingHoursStart"
            label="Opening time"
            required
            error={errors?.operatingHoursStart}
          >
            <TimePicker
              id="operatingHoursStart"
              value={opens}
              onChange={setOpens}
              aria-invalid={errors?.operatingHoursStart !== undefined}
            />
            <input type="hidden" name="operatingHoursStart" value={opens} />
          </Field>
          <Field
            id="operatingHoursEnd"
            label="Closing time"
            required
            error={errors?.operatingHoursEnd}
          >
            <TimePicker
              id="operatingHoursEnd"
              value={closes}
              onChange={setCloses}
              aria-invalid={errors?.operatingHoursEnd !== undefined}
            />
            <input type="hidden" name="operatingHoursEnd" value={closes} />
          </Field>
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
          <datalist id="standard-layouts">
            {STANDARD_LAYOUTS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          {layouts.map((row, index) => (
            <div key={row.key} className="grid items-start gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <Field
                id={`layoutName-${row.key}`}
                label="Layout"
                required
                error={errors?.[`layouts.${index}.name`]}
              >
                <Input
                  id={`layoutName-${row.key}`}
                  name="layoutName"
                  list="standard-layouts"
                  placeholder="Theatre, cabaret, classroom…"
                  required
                  aria-invalid={errors?.[`layouts.${index}.name`] !== undefined}
                  value={row.name}
                  onChange={(event) => updateLayout(row.key, { name: event.target.value })}
                />
              </Field>
              <Field
                id={`layoutCapacity-${row.key}`}
                label="Capacity"
                required
                error={errors?.[`layouts.${index}.capacity`]}
              >
                <Input
                  id={`layoutCapacity-${row.key}`}
                  name="layoutCapacity"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="120"
                  required
                  aria-invalid={errors?.[`layouts.${index}.capacity`] !== undefined}
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

