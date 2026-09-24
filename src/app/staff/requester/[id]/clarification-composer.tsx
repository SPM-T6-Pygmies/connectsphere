"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  postClarificationMessageAction,
  type PostClarificationMessageState,
} from "./actions";

const INITIAL: PostClarificationMessageState = { status: "idle" };

/**
 * SPM-33 AC4-AC5: the Organiser's reply box.
 *
 * The Organiser's only control on this screen. There is no Resolve here --
 * marking a clarification resolved is the Coordinator's alone (AC7) -- and no
 * field became editable: this posts a message and nothing else.
 *
 * `parentId` is empty for a new top-level message and carries the message
 * being answered for a reply, which is one level of nesting and no more
 * (decision 6).
 */
export function ClarificationComposer({
  eventRequestId,
  parentId = "",
  placeholder,
}: {
  eventRequestId: string;
  parentId?: string;
  placeholder?: string;
}) {
  const [state, formAction, pending] = useActionState(postClarificationMessageAction, INITIAL);
  const isReply = parentId !== "";

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={eventRequestId} />
      <input type="hidden" name="parentId" value={parentId} />

      <Textarea
        name="body"
        placeholder={placeholder ?? (isReply ? "Leave a reply…" : "Add to the conversation…")}
        aria-label={isReply ? "Leave a reply" : "Add to the conversation"}
        disabled={pending}
        rows={isReply ? 2 : 3}
      />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {isReply ? "Reply" : "Comment"}
      </Button>
    </form>
  );
}
