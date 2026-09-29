"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  clarificationComposerAction,
  resolveClarificationAction,
  type ClarificationComposerState,
  type ResolveClarificationState,
} from "./actions";

const COMPOSER_INITIAL: ClarificationComposerState = { status: "idle" };
const RESOLVE_INITIAL: ResolveClarificationState = { status: "idle" };

/**
 * SPM-33: the one box the Coordinator says anything in.
 *
 * Two submit buttons, one form: React puts the pressed button's `name` and
 * `value` into the FormData, so neither may carry a `formAction` of its own
 * (that drops the value) -- the same constraint `DecisionForm` works under.
 *
 * "Comment & return" is the only thing that moves the request, and it is a
 * button rather than a side effect of posting: a Coordinator's own "thanks,
 * that's all I needed" should not relabel the request as waiting on the
 * Organiser.
 *
 * Shown under a message (`parentId` set) it is a plain reply box. Returning
 * opens a new exchange rather than continuing one, so it is top-level by
 * definition and the second button does not appear there.
 */
export function ClarificationComposer({
  eventRequestId,
  parentId = "",
  canReturn = false,
}: {
  eventRequestId: string;
  parentId?: string;
  /** False once the request is decided -- there is nothing left to clarify. */
  canReturn?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    clarificationComposerAction,
    COMPOSER_INITIAL,
  );
  const isReply = parentId !== "";

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={eventRequestId} />
      <input type="hidden" name="parentId" value={parentId} />

      <Textarea
        name="body"
        placeholder={isReply ? "Leave a reply…" : "Ask the organiser, or add a note…"}
        aria-label={isReply ? "Leave a reply" : "Add to the conversation"}
        // React resets the form after every action; a refusal re-seeds what
        // was typed rather than losing it.
        defaultValue={state.status === "error" ? state.body : ""}
        disabled={pending}
        rows={isReply ? 2 : 3}
      />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="comment" size="sm" disabled={pending}>
          {isReply ? "Reply" : "Comment"}
        </Button>
        {isReply || !canReturn ? null : (
          <Button
            type="submit"
            name="intent"
            value="return"
            size="sm"
            variant="outline"
            disabled={pending}
          >
            Comment &amp; return
          </Button>
        )}
      </div>

      {isReply || !canReturn ? null : (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Returning puts the request back with the organiser. You can still
          approve or reject it while you wait.
        </p>
      )}
    </form>
  );
}

/**
 * SPM-33 AC6: mark one question answered.
 *
 * Sits on the question it closes rather than on the request, because a
 * Coordinator can have two outstanding at once and answering one of them is
 * not the same as no longer waiting. Clearing the last one is what puts the
 * request back in the decision queue.
 *
 * Its own form rather than a button on the composer: resolving says nothing,
 * so it has no message to carry (decision 3).
 */
export function ResolveClarificationForm({
  eventRequestId,
  clarificationMessageId,
}: {
  eventRequestId: string;
  clarificationMessageId: string;
}) {
  const [state, formAction, pending] = useActionState(resolveClarificationAction, RESOLVE_INITIAL);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={eventRequestId} />
      <input type="hidden" name="clarificationMessageId" value={clarificationMessageId} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Resolve
      </Button>
    </form>
  );
}
