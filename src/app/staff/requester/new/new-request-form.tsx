"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

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
import { MANDATORY_SUBMISSION_FIELDS } from "@/core/domain/event-request";
import type { SubmitEventRequestResult } from "@/core/ports/inbound/submit-event-request";

import { PageHeader } from "../../staff-shell";
import {
  EMPTY_FORM,
  submitEventRequestAction,
  type FormField,
  type FormValues,
  type SubmitRequestState,
} from "./actions";

const INITIAL: SubmitRequestState = { status: "idle" };

/**
 * The mandatory set as a lookup, read from the core's own list.
 *
 * Marking a field required here and enforcing it there would be two answers to
 * one question, and #72 has not settled that question yet -- when it does, the
 * array changes in the domain and these markers follow.
 */
const MANDATORY = new Set<string>(MANDATORY_SUBMISSION_FIELDS);

function isMandatory(field: FormField): boolean {
  return MANDATORY.has(field);
}

function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

export function NewRequestForm({ initialValues }: { initialValues?: Partial<FormValues> }) {
  const [state, formAction, pending] = useActionState(submitEventRequestAction, INITIAL);
  const [values, setValues] = useState<FormValues>({ ...EMPTY_FORM, ...initialValues });

  // SPM-31 AC5: submission does not disable the form, it replaces it. Nothing
  // the Organiser could edit with survives into this state -- no inputs, no
  // submit button -- because leaving them in place is the natural
  // implementation and the one the customer forbids (#102).
  if (state.status === "submitted") {
    return <Acknowledgement result={state.result} />;
  }

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const readyToSubmit = MANDATORY_SUBMISSION_FIELDS.every((field) => isFilled(values[field]));

  function set(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function field(name: FormField) {
    return {
      name,
      value: values[name],
      required: isMandatory(name),
      "aria-invalid": errors?.[name] !== undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        set(name, event.target.value),
    };
  }

  return (
    <form action={formAction} className="space-y-6">
      <PageHeader
        title="New event request"
        description="Tell us what you need and submit. Once submitted, changes go through your Event Coordinator."
        actions={
          <>
            <Button variant="outline" asChild type="button">
              <Link href="/staff/requester">Cancel</Link>
            </Button>
            <Button type="submit" disabled={!readyToSubmit || pending}>
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </>
        }
      />

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
          Fields marked <span className="text-destructive">*</span> are needed before you can
          submit. Everything else can be filled in later with your coordinator.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The event</CardTitle>
              <CardDescription>What you are running, and why.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="eventName" label="Event name" required errors={errors?.eventName}>
                <Input id="eventName" placeholder="Annual Client Forum" {...field("eventName")} />
              </Field>
              <Field id="description" label="Description" errors={errors?.description}>
                <Textarea
                  id="description"
                  placeholder="A short description of the event."
                  {...field("description")}
                />
              </Field>
              <Field id="purpose" label="Purpose" errors={errors?.purpose}>
                <Textarea
                  id="purpose"
                  placeholder="What the event is meant to achieve."
                  {...field("purpose")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>When and how many</CardTitle>
              <CardDescription>
                Venues are booked in AM, PM and Night slots, so the coordinator will map your
                times onto those.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="preferredDate" label="Preferred date" required errors={errors?.preferredDate}>
                <Input id="preferredDate" type="date" {...field("preferredDate")} />
              </Field>
              <Field id="preferredTime" label="Preferred time" required errors={errors?.preferredTime}>
                <Input id="preferredTime" placeholder="09:00 - 17:00" {...field("preferredTime")} />
              </Field>
              <Field
                id="expectedAttendance"
                label="Expected attendance"
                required
                hint="Used to check venue capacity and layout suitability."
                errors={errors?.expectedAttendance}
              >
                <Input
                  id="expectedAttendance"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="120"
                  {...field("expectedAttendance")}
                />
              </Field>
              <Field
                id="roomLayoutPreferences"
                label="Room layout preference"
                errors={errors?.roomLayoutPreferences}
              >
                <Input
                  id="roomLayoutPreferences"
                  placeholder="Theatre, cabaret, classroom…"
                  {...field("roomLayoutPreferences")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>
                The more specific you are here, the fewer clarification rounds the coordinator
                needs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                id="venueRequirements"
                label="Venue requirements"
                hint="Size, location, facilities, anything the space must have."
                errors={errors?.venueRequirements}
              >
                <Textarea id="venueRequirements" {...field("venueRequirements")} />
              </Field>
              <Field
                id="accessibilityNeeds"
                label="Accessibility needs"
                errors={errors?.accessibilityNeeds}
              >
                <Textarea
                  id="accessibilityNeeds"
                  placeholder="Step-free access, hearing loop, captions…"
                  {...field("accessibilityNeeds")}
                />
              </Field>
              <Field
                id="equipmentRequirements"
                label="Equipment requirements"
                hint="Technical support will check what can actually be reserved."
                errors={errors?.equipmentRequirements}
              >
                <Textarea
                  id="equipmentRequirements"
                  placeholder="Projectors, microphones, video-conferencing kit…"
                  {...field("equipmentRequirements")}
                />
              </Field>
              <Field
                id="registrationRequirements"
                label="Registration requirements"
                errors={errors?.registrationRequirements}
              >
                <Textarea
                  id="registrationRequirements"
                  placeholder="Public registration, invite-only, capacity cap…"
                  {...field("registrationRequirements")}
                />
              </Field>
              <Field
                id="generalProgramme"
                label="General programme"
                errors={errors?.generalProgramme}
              >
                <Textarea
                  id="generalProgramme"
                  placeholder="Rough running order, session times."
                  {...field("generalProgramme")}
                />
              </Field>
              <Field
                id="otherSpecialArrangements"
                label="Other special arrangements"
                errors={errors?.otherSpecialArrangements}
              >
                <Textarea
                  id="otherSpecialArrangements"
                  {...field("otherSpecialArrangements")}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {[
                  "You submit the request.",
                  "An Event Operations Manager assigns a coordinator.",
                  "Your coordinator reviews it and may ask for clarification.",
                  "They approve it so planning can start.",
                  "Venue and equipment are arranged.",
                  "The event is confirmed once everything essential is in place.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-xs">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  required,
  errors,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-label="required">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {errors?.length ? (
        <p className="text-destructive text-xs">{errors[0]}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * SPM-31 AC2, and the read-only half of AC4/AC5.
 *
 * Everything shown here is read back from what the server recorded, not echoed
 * from the form -- including the reference, which is the only handle the
 * Organiser has on the request afterwards.
 */
function Acknowledgement({ result }: { result: SubmitEventRequestResult }) {
  return (
    <div className="space-y-6" role="status">
      <PageHeader
        title="Request submitted"
        description="ConnectSphere has your request. Your coordinator will be in touch."
        actions={
          <Button asChild variant="outline">
            <Link href="/staff/requester">Back to my requests</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2Icon aria-hidden className="size-5 shrink-0" />
            {result.summary.eventName}
          </CardTitle>
          <CardDescription>Reference {result.eventRequestId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Recorded label="Status" value={result.status} />
            <Recorded
              label="Submitted"
              value={new Date(result.submittedAt).toLocaleString("en-SG")}
            />
            <Recorded label="Preferred date" value={result.summary.preferredDate} />
            <Recorded label="Preferred time" value={result.summary.preferredTime} />
            <Recorded
              label="Expected attendance"
              value={result.summary.expectedAttendance?.toString() ?? null}
            />
          </dl>

          <p className="text-muted-foreground border-t pt-4 text-sm">
            This request is now read-only. Any change &mdash; however small &mdash; goes through
            your assigned Event Coordinator rather than being edited here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Recorded({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
