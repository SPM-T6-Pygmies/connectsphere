"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STANDARD_LAYOUTS } from "@/core/domain/venue";
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from "@/core/domain/venue-options";

import { OptionCheckboxes, OptionSelect } from "../../option-fields";

export interface VenueSearchValues {
  layout: string;
  attendance: string;
  facilities: string;
  accessibility: string;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * The venue search filters (SPM-44). Submits as a GET so a search is a link the
 * Coordinator can reload or share. Every filter is optional.
 */
export function VenueSearchForm({
  initial,
  errors,
}: {
  initial: VenueSearchValues;
  errors: Partial<Record<keyof VenueSearchValues, string>>;
}) {
  const [layout, setLayout] = useState(initial.layout);
  const [facilities, setFacilities] = useState(initial.facilities);
  const [accessibility, setAccessibility] = useState(initial.accessibility);

  return (
    <form method="get" className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="date" label="Date" error={errors.date}>
          <Input id="date" name="date" type="date" defaultValue={initial.date} aria-invalid={!!errors.date} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startTime" label="Start time" error={errors.startTime}>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={initial.startTime}
            aria-invalid={!!errors.startTime}
          />
        </Field>
        <Field id="endTime" label="End time" error={errors.endTime}>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={initial.endTime}
            aria-invalid={!!errors.endTime}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="layout" label="Room layout" error={errors.layout}>
          <OptionSelect
            id="layout"
            name="layout"
            options={STANDARD_LAYOUTS}
            value={layout}
            onChange={setLayout}
            blank="Any layout"
            aria-invalid={!!errors.layout}
          />
        </Field>
        <Field id="attendance" label="Attendance" error={errors.attendance}>
          <Input
            id="attendance"
            name="attendance"
            type="number"
            min={1}
            step={1}
            defaultValue={initial.attendance}
            aria-invalid={!!errors.attendance}
          />
        </Field>
      </div>
      <Field id="facilities" label="Facilities" error={errors.facilities}>
        <OptionCheckboxes
          name="facilities"
          options={FACILITY_OPTIONS}
          value={facilities}
          onChange={setFacilities}
        />
      </Field>
      <Field id="accessibility" label="Accessibility" error={errors.accessibility}>
        <OptionCheckboxes
          name="accessibility"
          options={ACCESSIBILITY_OPTIONS}
          value={accessibility}
          onChange={setAccessibility}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Search
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/staff/coordinator/venues">Clear</Link>
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
