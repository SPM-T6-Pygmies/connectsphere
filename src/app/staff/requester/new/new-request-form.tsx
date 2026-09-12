"use client";

import { CheckCircle2Icon, ChevronDownIcon, ClockIcon } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MANDATORY_SUBMISSION_FIELDS } from "@/core/domain/event-request";
import type { SubmitEventRequestResult } from "@/core/use-cases/submit-event-request";

import { PageHeader } from "../../page-header";
import {
  discardEventRequestDraftAction,
  saveEventRequestDraftAction,
  submitEventRequestAction,
  type DiscardDraftState,
  type SaveDraftState,
  type SubmitRequestState,
} from "./actions";
import { EMPTY_FORM, type FormField, type FormValues } from "./form-fields";

const INITIAL: SubmitRequestState = { status: "idle" };
const DRAFT_INITIAL: SaveDraftState = { status: "idle" };
const DISCARD_INITIAL: DiscardDraftState = { status: "idle" };

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

/**
 * A real instant, built from the Organiser's own local date+time parts.
 *
 * The multi-arg `Date` constructor interprets `(y, m, d, h, min)` as local
 * time in whatever timezone the code runs in -- this file is a client
 * component, so that's the Organiser's own browser. `toISOString()` then
 * hands the server an unambiguous UTC instant, so the `timestamptz` column
 * ends up holding the moment the Organiser actually meant, not that clock
 * reading reinterpreted in the server's own timezone.
 */
function toInstant(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) {
    return "";
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

/**
 * The inverse of `toInstant`: the local `HH:mm` a saved instant reads as in
 * the Organiser's own browser, so resuming a draft (SPM-38) shows the time
 * they actually picked rather than reinterpreting it in the server's zone.
 */
function toTimeOnly(iso: string | undefined): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * "YYYY-MM-DD" -> a local `Date` at midnight, for the Calendar picker.
 *
 * Not `new Date(value)`: that parses a bare date as UTC midnight, which
 * reads as the previous day west of UTC -- the same local-parts
 * construction `toInstant` already relies on.
 */
function parseCalendarDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The inverse of `parseCalendarDate`: what the Calendar picker's selection posts as. */
function toCalendarDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "HH:mm" -> "h:mm AM/PM", the same wording `formatInstantTime` uses once submitted. */
function formatTimeOnly(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours < 12 ? "AM" : "PM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function NewRequestForm({
  initialValues,
  initialEventRequestId,
}: {
  initialValues?: Partial<FormValues>;
  initialEventRequestId?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitEventRequestAction, INITIAL);
  const [draftState, draftFormAction, draftPending] = useActionState(
    saveEventRequestDraftAction,
    DRAFT_INITIAL,
  );
  const [discardState, discardFormAction, discardPending] = useActionState(
    discardEventRequestDraftAction,
    DISCARD_INITIAL,
  );
  // Discarding is destructive, so it asks once more before the form action
  // actually fires, rather than acting on the first click.
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [values, setValues] = useState<FormValues>({ ...EMPTY_FORM, ...initialValues });
  // Blank for a fresh request; an existing draft's id when resuming one
  // (`?draft=` on this page), so the first save updates that same row
  // instead of raising a second request. Carried on the submit path too
  // (SPM-38): finishing a saved draft updates it rather than inserting a
  // second one.
  const [eventRequestId] = useState(initialEventRequestId ?? "");

  // A saved draft is written to the store, so there is nothing left on this
  // page for the Organiser to keep doing -- send them back to the list where
  // the draft now shows up, with a toast standing in for the confirmation
  // the redirect itself does not carry.
  useEffect(() => {
    if (draftState.status === "saved") {
      toast.success("Draft saved.");
      router.push("/staff/requester");
    }
  }, [draftState, router]);

  // Same reasoning as the save effect above: once the store no longer has
  // this draft, there is nothing left here to edit.
  useEffect(() => {
    if (discardState.status === "discarded") {
      toast.success("Draft discarded.");
      router.push("/staff/requester");
    }
  }, [discardState, router]);
  // Time-of-day only: the Organiser picks one preferred date and two times
  // against it, not two independent instants. Composed into full
  // preferredStartTime/preferredEndTime instants below, which is what
  // actually gets submitted (see the hidden inputs) -- these two never are.
  const [startTimeOnly, setStartTimeOnly] = useState(() =>
    toTimeOnly(initialValues?.preferredStartTime),
  );
  const [endTimeOnly, setEndTimeOnly] = useState(() => toTimeOnly(initialValues?.preferredEndTime));
  // Read once, from the browser's own Intl data -- the server has no other
  // way to know which "today" the future-date rule should mean.
  const [organiserTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  // SPM-31 AC5: submission does not disable the form, it replaces it. Nothing
  // the Organiser could edit with survives into this state -- no inputs, no
  // submit button -- because leaving them in place is the natural
  // implementation and the one the customer forbids (#102).
  if (state.status === "submitted") {
    return <Acknowledgement result={state.result} />;
  }

  const errors = state.status === "error" ? state.fieldErrors : undefined;

  const preferredStartTime = toInstant(values.preferredDate, startTimeOnly);
  const preferredEndTime = toInstant(values.preferredDate, endTimeOnly);
  const effectiveValues: FormValues = { ...values, preferredStartTime, preferredEndTime };
  const readyToSubmit = MANDATORY_SUBMISSION_FIELDS.every((field) => isFilled(effectiveValues[field]));

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
      <input type="hidden" name="organiserTimeZone" value={organiserTimeZone} />
      <input type="hidden" name="eventRequestId" value={eventRequestId} />
      <PageHeader
        title="Create New Event Request"
        description="Tell us what you need and submit. Once submitted, changes go through your Event Coordinator."
      />

      {state.status === "error" ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {state.message}
        </p>
      ) : null}

      {draftState.status === "error" ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {draftState.message}
        </p>
      ) : null}

      {discardState.status === "error" ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {discardState.message}
        </p>
      ) : null}

      {!readyToSubmit ? (
        <p className="text-muted-foreground text-sm">
          Fields marked <span className="text-destructive">*</span> are mandatory.
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
                Tell us your preferred date and time window
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="preferredDate" label="Preferred date" required errors={errors?.preferredDate}>
                <DatePicker
                  id="preferredDate"
                  value={values.preferredDate}
                  onChange={(date) => set("preferredDate", date)}
                  aria-invalid={errors?.preferredDate !== undefined}
                />
                <input type="hidden" name="preferredDate" value={values.preferredDate} />
              </Field>
              <Field
                id="preferredStartTime"
                label="Preferred start time"
                required
                hint="Combined with the preferred date above."
                errors={errors?.preferredStartTime}
              >
                <TimePicker
                  id="preferredStartTime"
                  value={startTimeOnly}
                  onChange={setStartTimeOnly}
                  aria-invalid={errors?.preferredStartTime !== undefined}
                />
                <input type="hidden" name="preferredStartTime" value={preferredStartTime} />
              </Field>
              <Field
                id="preferredEndTime"
                label="Preferred end time"
                required
                hint="Combined with the preferred date above."
                errors={errors?.preferredEndTime}
              >
                <TimePicker
                  id="preferredEndTime"
                  value={endTimeOnly}
                  onChange={setEndTimeOnly}
                  aria-invalid={errors?.preferredEndTime !== undefined}
                />
                <input type="hidden" name="preferredEndTime" value={preferredEndTime} />
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

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" asChild type="button">
              <Link href="/staff/requester">Cancel</Link>
            </Button>
            {eventRequestId ? (
              confirmingDiscard ? (
                <>
                  <span className="text-muted-foreground text-sm">Discard this draft?</span>
                  <Button variant="outline" type="button" onClick={() => setConfirmingDiscard(false)}>
                    Keep draft
                  </Button>
                  <Button
                    variant="destructive"
                    type="submit"
                    formAction={discardFormAction}
                    formNoValidate
                    disabled={discardPending}
                  >
                    {discardPending ? "Discarding…" : "Yes, discard"}
                  </Button>
                </>
              ) : (
                <Button variant="destructive" type="button" onClick={() => setConfirmingDiscard(true)}>
                  Discard draft
                </Button>
              )
            ) : null}
            <Button
              variant="outline"
              type="submit"
              formAction={draftFormAction}
              formNoValidate
              disabled={draftPending}
            >
              {draftPending ? "Saving…" : "Save draft"}
            </Button>
            <Button type="submit" disabled={!readyToSubmit || pending}>
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
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

/** The preferred date, picked from a Calendar in a Popover rather than the browser's own date chrome. */
function DatePicker({
  id,
  value,
  onChange,
  "aria-invalid": ariaInvalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseCalendarDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={ariaInvalid}
          className="w-full justify-between font-normal"
        >
          {selected ? formatCalendarDate(value) : "Pick a date"}
          <ChevronDownIcon className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          captionLayout="dropdown"
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? toCalendarDateString(date) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * A preferred start/end time. Still a real `<input type="time">` underneath
 * -- clicking it opens the browser's own time picker, same as `DatePicker`
 * opens a real Calendar -- but its native empty-state placeholder
 * ("--:-- --") and locale-dependent rendering can't be restyled directly, so
 * a formatted label sits visually on top while the actual input stays fully
 * interactive (and transparent) underneath it.
 */
function TimePicker({
  id,
  value,
  onChange,
  "aria-invalid": ariaInvalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm",
          !value && "text-muted-foreground",
          ariaInvalid && "border-destructive",
        )}
      >
        {value ? formatTimeOnly(value) : "HH:MM AM/PM"}
        <ClockIcon className="text-muted-foreground size-4" />
      </div>
      <Input
        id={id}
        type="time"
        required
        aria-invalid={ariaInvalid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 opacity-0"
      />
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
        description="ConnectSphere has your request. Your Event Coordinator will be in touch."
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
          <CardDescription>Request ID: {result.eventRequestId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Recorded label="Status" value={result.status} />
            <Recorded
              label="Submitted"
              value={`${formatInstantDate(result.submittedAt)}, ${formatInstantTime(result.submittedAt)}`}
            />
            <Recorded
              label="Preferred date & time"
              value={preferredWhen(result.summary)}
              className="sm:col-span-2"
            />
            <Recorded
              label="Expected attendance"
              value={result.summary.expectedAttendance?.toString() ?? null}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Recorded({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}

/** `DD/MM/YYYY`, read straight off a calendar `date` string -- no `Date`, no timezone to get wrong. */
function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** `DD/MM/YYYY`, in the viewer's own timezone -- for an instant, not a calendar date. */
function formatInstantDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** `h:mm am/pm`, in the viewer's own timezone. */
function formatInstantTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** One line: the calendar date the Organiser asked for, and the time span against it. */
function preferredWhen(summary: SubmitEventRequestResult["summary"]): string | null {
  if (!summary.preferredDate || !summary.preferredStartTime || !summary.preferredEndTime) {
    return null;
  }

  return `${formatCalendarDate(summary.preferredDate)}, ${formatInstantTime(summary.preferredStartTime)} – ${formatInstantTime(summary.preferredEndTime)}`;
}
