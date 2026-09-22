import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClarificationMessageView } from "@/core/use-cases/event-request-view";

/** One top-level message and the replies made to it. */
interface Exchange {
  readonly opener: ClarificationMessageView;
  readonly replies: readonly ClarificationMessageView[];
}

/**
 * The thread as it reads: each top-level message carrying its own replies.
 *
 * One level deep (SPM-33 decision 6) -- a reply whose parent is missing is
 * shown on its own rather than dropped, so nothing said can vanish from the
 * record AC4 asks for.
 */
function exchanges(messages: readonly ClarificationMessageView[]): Exchange[] {
  const byParent = new Map<string, ClarificationMessageView[]>();
  for (const message of messages) {
    if (message.parentId !== null) {
      byParent.set(message.parentId, [...(byParent.get(message.parentId) ?? []), message]);
    }
  }

  const openers = messages.filter(
    (message) => message.parentId === null || !messages.some((m) => m.id === message.parentId),
  );

  return openers.map((opener) => ({ opener, replies: byParent.get(opener.id) ?? [] }));
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function Avatar({ name, className = "size-6" }: { name: string; className?: string }) {
  return (
    <span
      className={`bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/** "3d ago", falling back gracefully for anything outside a day/month/year window. */
function timeAgo(timestamp: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < month) return `${Math.floor(diffMs / day)}d ago`;
  if (diffMs < year) return `${Math.floor(diffMs / month)}mo ago`;
  return `${Math.floor(diffMs / year)}y ago`;
}

function Message({
  message,
  reply = false,
}: {
  message: ClarificationMessageView;
  reply?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Avatar name={message.authorName} className={reply ? "size-5" : "size-6"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{message.authorName}</span>
          <span className="text-muted-foreground text-xs" title={message.postedAt}>
            {timeAgo(message.postedAt)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{message.body}</p>
      </div>
    </div>
  );
}

/**
 * A request's clarification exchange (SPM-33 AC4-AC6).
 *
 * Each top-level message is its own block with its own replies and its own
 * reply box, the way Linear breaks a discussion into threads, rather than one
 * flat rail -- two questions in flight stay two readable conversations instead
 * of interleaving into one.
 *
 * Deliberately not `ActivityPanel`. That panel renders an event's interleaved
 * activity-and-comment trail, which is a different thing: it has no notion of
 * a question, a resolution, or a block that can be closed. SPM-161 asked for
 * reuse to avoid a duplicate wireframe rail; once per-thread resolution
 * arrived the two stopped being the same component, and forcing them together
 * would mean a variant flag that changes almost everything.
 */
export function ClarificationThread({
  messages,
  actingAsName,
  emptyMessage,
  description,
  composer,
  replyComposer,
  resolveControl,
}: {
  messages: readonly ClarificationMessageView[];
  /** Who the viewer is, for the composer's avatar. */
  actingAsName: string;
  emptyMessage: string;
  description: string;
  /** The box for starting a new message, beneath the whole thread. */
  composer: ReactNode;
  /** A reply box for one block. */
  replyComposer: (parentId: string) => ReactNode;
  /** The Coordinator's Resolve for an open question. Absent on the Organiser's surface (AC7). */
  resolveControl?: (message: ClarificationMessageView) => ReactNode;
}) {
  const blocks = exchanges(messages);
  const open = blocks.filter(
    ({ opener }) => opener.isClarificationRequest && opener.resolvedAt === null,
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clarification</CardTitle>
        <CardDescription>
          {description}
          {open > 0
            ? ` ${open} question${open === 1 ? "" : "s"} still open.`
            : messages.length > 0
              ? " Nothing outstanding."
              : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {blocks.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {blocks.map(({ opener, replies }) => {
              const resolved = opener.resolvedAt !== null;

              return (
                <li
                  key={opener.id}
                  className={`rounded-lg border ${resolved ? "bg-muted/30" : "bg-card"}`}
                >
                  <div className="space-y-3 p-4">
                    {opener.isClarificationRequest ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            resolved
                              ? "bg-muted text-muted-foreground"
                              : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          }`}
                        >
                          {resolved ? <CheckIcon className="size-3" aria-hidden /> : null}
                          {resolved ? "Resolved" : "Awaiting an answer"}
                        </span>
                      </div>
                    ) : null}

                    <Message message={opener} />

                    {replies.length > 0 ? (
                      <ul className="border-border ml-3 space-y-3 border-l pl-4">
                        {replies.map((reply) => (
                          <li key={reply.id}>
                            <Message message={reply} reply />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-3 border-t px-4 py-3">
                    <div className="min-w-[16rem] flex-1">{replyComposer(opener.id)}</div>
                    {resolveControl?.(opener)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex gap-3 border-t pt-4">
          <Avatar name={actingAsName} />
          <div className="min-w-0 flex-1">{composer}</div>
        </div>
      </CardContent>
    </Card>
  );
}
