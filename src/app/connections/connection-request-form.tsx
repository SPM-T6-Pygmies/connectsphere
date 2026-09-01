"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { sendConnectionRequestAction, type ConnectionRequestState } from "./actions";

const INITIAL: ConnectionRequestState = { status: "idle" };

export function ConnectionRequestForm() {
  const [state, formAction, pending] = useActionState(sendConnectionRequestAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="requesterId">Your member id</Label>
        <Input id="requesterId" name="requesterId" placeholder="uuid" required />
        {state.status === "error" && state.fieldErrors?.requesterId ? (
          <p className="text-destructive text-sm">{state.fieldErrors.requesterId[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="addresseeId">Member to connect with</Label>
        <Input id="addresseeId" name="addresseeId" placeholder="uuid" required />
        {state.status === "error" && state.fieldErrors?.addresseeId ? (
          <p className="text-destructive text-sm">{state.fieldErrors.addresseeId[0]}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>

      {state.status === "error" && !state.fieldErrors ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}

      {state.status === "sent" ? (
        <p className="text-sm text-muted-foreground">
          Request sent. Connection {state.connectionId} is pending.
        </p>
      ) : null}
    </form>
  );
}
