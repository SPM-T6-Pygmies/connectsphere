import { InfoIcon } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { eventById, type EventRequestRecord } from "@/lib/wireframe";

import { PageHeader, StaffShell } from "../../staff-shell";

export const metadata = { title: "New event request | ConnectSphere" };

const CATEGORIES = [
  "Conference",
  "Workshop",
  "Training session",
  "Exhibition",
  "Meeting",
  "Seminar",
  "Networking event",
];

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export default async function NewRequestPage({
  searchParams,
}: PageProps<"/staff/requester/new">) {
  const { draft } = await searchParams;
  const draftId = typeof draft === "string" ? draft : undefined;
  const existing: EventRequestRecord | undefined = draftId
    ? eventById(draftId)?.request
    : undefined;

  return (
    <StaffShell
      role="requester"
      crumbs={[
        { label: "My requests", href: "/staff/requester" },
        { label: existing ? "Edit draft" : "New request" },
      ]}
    >
      <PageHeader
        title={existing ? existing.eventName : "New event request"}
        description="Save at any point and come back to it. Nothing is sent to ConnectSphere until you submit."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/staff/requester">Cancel</Link>
            </Button>
            <Button variant="outline">Save draft</Button>
            <Button>Submit request</Button>
          </>
        }
      />

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Which fields are mandatory is still open</AlertTitle>
        <AlertDescription>
          <p>
            The customer has not fixed a minimum set for submission, and no
            minimum lead time has been set between raising a request and the
            event date. Both are for the team to propose, so nothing here is
            marked required yet.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>The event</CardTitle>
              <CardDescription>What you are running, and why.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="eventName" label="Event name">
                <Input
                  id="eventName"
                  defaultValue={existing?.eventName ?? ""}
                  placeholder="Annual Client Forum"
                />
              </Field>
              <Field id="categoryType" label="Category">
                <select
                  id="categoryType"
                  defaultValue={existing?.categoryType ?? ""}
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3"
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="description" label="Description">
                <Textarea
                  id="description"
                  defaultValue={existing?.description ?? ""}
                  placeholder="A short description of the event."
                />
              </Field>
              <Field id="purpose" label="Purpose">
                <Textarea
                  id="purpose"
                  defaultValue={existing?.purpose ?? ""}
                  placeholder="What the event is meant to achieve."
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>When and how many</CardTitle>
              <CardDescription>
                Venues are booked in AM, PM and Night slots, so the coordinator
                will map your times onto those.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="preferredDate" label="Preferred date">
                <Input
                  id="preferredDate"
                  type="date"
                  defaultValue={existing?.preferredDate ?? ""}
                />
              </Field>
              <Field id="preferredTime" label="Preferred time">
                <Input
                  id="preferredTime"
                  defaultValue={existing?.preferredTime ?? ""}
                  placeholder="09:00 - 17:00"
                />
              </Field>
              <Field
                id="expectedAttendance"
                label="Expected attendance"
                hint="Used to check venue capacity and layout suitability."
              >
                <Input
                  id="expectedAttendance"
                  type="number"
                  min={0}
                  defaultValue={existing?.expectedAttendance ?? ""}
                  placeholder="120"
                />
              </Field>
              <Field id="roomLayoutPreferences" label="Room layout preference">
                <Input
                  id="roomLayoutPreferences"
                  defaultValue={existing?.roomLayoutPreferences ?? ""}
                  placeholder="Theatre, cabaret, classroom…"
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>
                The more specific you are here, the fewer clarification rounds
                the coordinator needs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                id="venueRequirements"
                label="Venue requirements"
                hint="Size, location, facilities, anything the space must have."
              >
                <Textarea
                  id="venueRequirements"
                  defaultValue={existing?.venueRequirements ?? ""}
                />
              </Field>
              <Field id="accessibilityNeeds" label="Accessibility needs">
                <Textarea
                  id="accessibilityNeeds"
                  defaultValue={existing?.accessibilityNeeds ?? ""}
                  placeholder="Step-free access, hearing loop, captions…"
                />
              </Field>
              <Field
                id="equipmentRequirements"
                label="Equipment requirements"
                hint="Technical support will check what can actually be reserved."
              >
                <Textarea
                  id="equipmentRequirements"
                  defaultValue={existing?.equipmentRequirements ?? ""}
                  placeholder="Projectors, microphones, video-conferencing kit…"
                />
              </Field>
              <Field
                id="registrationRequirements"
                label="Registration requirements"
              >
                <Textarea
                  id="registrationRequirements"
                  defaultValue={existing?.registrationRequirements ?? ""}
                  placeholder="Public registration, invite-only, capacity cap…"
                />
              </Field>
              <Field id="generalProgramme" label="General programme">
                <Textarea
                  id="generalProgramme"
                  defaultValue={existing?.generalProgramme ?? ""}
                  placeholder="Rough running order, session times."
                />
              </Field>
              <Field
                id="otherSpecialArrangements"
                label="Other special arrangements"
              >
                <Textarea
                  id="otherSpecialArrangements"
                  defaultValue={existing?.otherSpecialArrangements ?? ""}
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
                    <span className="text-muted-foreground leading-relaxed">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
