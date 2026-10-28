"use client";

import { CircleAlert } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeRequest, ChangeRequestField, ItemDecision } from "@/core/domain/change-request";
import type { CurrentChangeRequestValues } from "@/core/use-cases/view-event-change-requests";

import { decideChangeRequestAction, type DecideChangeRequestState } from "./actions";
import { ChangeValue, CurrentValue } from "./change-value";
import { CHANGE_REQUEST_FIELD_LABELS } from "./field-labels";
import { readyToSave, type Choice } from "./ready-to-save";

const INITIAL: DecideChangeRequestState = { status: "idle" };


/**
 * SPM-100 AC1-AC3: one row per field the request covers -- what the event has
 * now, what is asked for, and Accept or Decline. A decline needs a reason, and
 * Save waits until every row is decided: one save decides the whole request
 * (2026-10-18 team decision). Submitted by hand, as the Organiser's form is,
 * so a refused save keeps the choices.
 */
export function DecideChangeRequestForm({
  eventId,
  request,
  current,
}: {
  eventId: string;
  request: ChangeRequest;
  current: CurrentChangeRequestValues;
}) {
  const [state, formAction, pending] = useActionState(decideChangeRequestAction, INITIAL);
  const [choices, setChoices] = useState<Partial<Record<ChangeRequestField, Choice>>>({});

  const fields = request.items.map((item) => item.change.field);
  const errorField = state.status === "error" ? state.field : null;

  function choose(field: ChangeRequestField, choice: Choice) {
    setChoices((previous) => ({ ...previous, [field]: choice }));
  }

  function decisions(): ItemDecision[] {
    return fields.flatMap((field): ItemDecision[] => {
      const choice = choices[field];
      if (choice === undefined) {
        return [];
      }
      return [choice.outcome === "Accepted" ? { field, outcome: "Accepted" } : { field, ...choice }];
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("eventId", eventId);
        formData.set("changeRequestId", request.id);
        formData.set("decisions", JSON.stringify(decisions()));
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field</TableHead>
            <TableHead>Now</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {request.items.map(({ change }) => {
            const field = change.field;
            const choice = choices[field];
            return (
              <TableRow key={field} aria-invalid={errorField === field}>
                <TableCell className="align-top font-medium">{CHANGE_REQUEST_FIELD_LABELS[field]}</TableCell>
                <TableCell className="align-top whitespace-normal">
                  <CurrentValue field={field} value={current[field]} />
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  <ChangeValue change={change} />
                </TableCell>
                <TableCell className="align-top">
                  <fieldset className="space-y-2">
                    <legend className="sr-only">{CHANGE_REQUEST_FIELD_LABELS[field]}</legend>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name={`decision-${field}`}
                          checked={choice?.outcome === "Accepted"}
                          onChange={() => choose(field, { outcome: "Accepted" })}
                        />
                        Accept
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name={`decision-${field}`}
                          checked={choice?.outcome === "Declined"}
                          onChange={() => choose(field, { outcome: "Declined", reason: "" })}
                        />
                        Decline
                      </label>
                    </div>
                    {choice?.outcome === "Declined" && (
                      <div className="space-y-1">
                        <Label htmlFor={`reason-${field}`}>Reason (required)</Label>
                        <Textarea
                          id={`reason-${field}`}
                          value={choice.reason}
                          onChange={(event) => choose(field, { outcome: "Declined", reason: event.target.value })}
                          rows={2}
                        />
                      </div>
                    )}
                  </fieldset>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Button type="submit" disabled={pending || !readyToSave(fields, choices)}>
        {pending ? "Saving…" : "Save decision"}
      </Button>
    </form>
  );
}
