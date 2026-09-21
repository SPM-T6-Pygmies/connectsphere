"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  postClarificationMessageAction,
  requestClarificationAction,
  resolveClarificationAction,
  type PostClarificationMessageState,
  type RequestClarificationState,
  type ResolveClarificationState,
} from "./actions";

const REQUEST_INITIAL: RequestClarificationState = { status: "idle" };
const RESOLVE_INITIAL: ResolveClarificationState = { status: "idle" };
const POST_INITIAL: PostClarificationMessageState = { status: "idle" };

/**
 * SPM-33 AC1-AC3: ask the Organiser something, which returns the request to
 * them.
 *
 * Sits with the approve/reject controls rather than apart from them: returning
 * is the third thing a Coordinator can do with a request in front of them, and
 * burying it elsewhere would make it read as an escape hatch.
 */
export function RequestClarificationForm({ eventRequestId }: { eventRequestId: string }) {
  const [state, formAction, pending] = useActionState(requestClarificationAction, REQUEST_INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={eventRequestId} />

      <div className="space-y-2">
        <Label htmlFor="clarification-message">What do you need to know?</Label>
        <Textarea
          id="clarification-message"
          name="message"
          placeholder="Ask the organiser for the detail you are missing…"
          // React resets the form after every action; a refused request
          // re-seeds what was typed rather than losing it.
          defaultValue={state.status === "error" ? state.clarificationMessage : ""}
          aria-describedby="clarification-message-hint"
          disabled={pending}
          rows={3}
        />
        <p id="clarification-message-hint" className="text-muted-foreground text-xs">
          Sending this puts the request back with the organiser. You can still
          approve or reject it while you wait.
        </p>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        Request clarification
      </Button>
    </form>
  );
}

/**
 * SPM-33 AC6: stop waiting on the Organiser, without deciding.
 *
 * Shown only while the request is `Returned`. A shortcut out of the
 * waiting-on-the-organiser label, not a gate in front of deciding -- the
 * decision controls stay visible beside it (decision 4).
 */
export function ResolveClarificationForm({ eventRequestId }: { eventRequestId: string }) {
  const [state, formAction, pending] = useActionState(resolveClarificationAction, RESOLVE_INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={eventRequestId} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        Mark clarification resolved
      </Button>
    </form>
  );
}

/**
 * SPM-33 AC5: say something more on the thread.
 *
 * `parentId` is empty for a new top-level message and carries the message
 * being answered for a reply -- one level of nesting, which is all the schema
 * and the store allow (decision 6).
 */
export function ClarificationComposer({
  eventRequestId,
  parentId = "",
  placeholder = "Add to the conversation…",
}: {
  eventRequestId: string;
  parentId?: string;
  placeholder?: string;
}) {
  const [state, formAction, pending] = useActionState(postClarificationMessageAction, POST_INITIAL);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={eventRequestId} />
      <input type="hidden" name="parentId" value={parentId} />

      <Textarea
        name="body"
        placeholder={placeholder}
        aria-label={parentId === "" ? "Add to the conversation" : "Reply"}
        disabled={pending}
        rows={parentId === "" ? 3 : 2}
      />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {parentId === "" ? "Comment" : "Reply"}
      </Button>
    </form>
  );
}
