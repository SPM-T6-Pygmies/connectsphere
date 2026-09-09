import { ArrowRightIcon, CornerDownRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  activityFor,
  commentCount,
  feedRows,
  type ActivitySection,
  type CommentThread,
} from "@/lib/wireframe";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
      {initials(name)}
    </span>
  );
}

function Comment({
  thread,
  reply = false,
}: {
  thread: CommentThread["entry"];
  reply?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Avatar name={thread.actor.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{thread.actor.name}</span>
          <span className="text-muted-foreground text-xs">{thread.at}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed">{thread.body}</p>
        {reply ? null : (
          <Button variant="ghost" size="xs" className="mt-1 -ml-2">
            Reply
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * What happened here, and what people said about it.
 *
 * One feed rather than a history block and a comments block: the useful
 * question on any of these screens is "what has gone on with this", and the
 * answer interleaves the two.
 *
 * Scoped to the section it sits on, with a link to the whole event's trail --
 * the Venue tab wants the venue's story, not every status change the event
 * has ever had.
 */
export function ActivityPanel({
  eventId,
  section,
  showAll = false,
  toggleHref,
  /** Comments only, for the external organiser: no internal activity. */
  commentsOnly = false,
}: {
  eventId: string;
  section: ActivitySection;
  showAll?: boolean;
  toggleHref?: string;
  commentsOnly?: boolean;
}) {
  const scoped = activityFor(eventId, showAll ? undefined : section);
  const entries = commentsOnly
    ? scoped.filter((entry) => entry.kind === "comment")
    : scoped;
  const rows = feedRows(entries);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{commentsOnly ? "Discussion" : "Activity"}</CardTitle>
        <CardDescription>
          {commentsOnly
            ? "Questions and answers between you and your coordinator, kept with the event."
            : showAll
              ? "Everything recorded against this event."
              : `What has happened on this section — ${commentCount(entries)} comment${commentCount(entries) === 1 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing here yet.</p>
        ) : (
          <ol className="space-y-5">
            {rows.map((row) =>
              row.kind === "activity" ? (
                <li
                  key={row.entry.id}
                  className="text-muted-foreground flex items-baseline gap-2 text-sm"
                >
                  <span className="bg-border mt-1.5 size-1.5 shrink-0 rounded-full" />
                  <span className="min-w-0">
                    <span className="text-foreground font-medium">
                      {row.entry.actor.name}
                    </span>{" "}
                    {row.entry.action}
                    {row.entry.field ? (
                      <span className="text-foreground/70">
                        {" — "}
                        {row.entry.field}:{" "}
                        <span className="line-through">{row.entry.from}</span>
                        <ArrowRightIcon className="mx-1 inline size-3" />
                        <span className="font-medium">{row.entry.to}</span>
                      </span>
                    ) : null}
                    <span className="ml-2 text-xs">{row.entry.at}</span>
                  </span>
                </li>
              ) : (
                <li key={row.thread.entry.id} className="space-y-3">
                  <Comment thread={row.thread.entry} />
                  {row.thread.replies.length > 0 ? (
                    <ul className="ml-3 space-y-3 border-l pl-4">
                      {row.thread.replies.map((replyEntry) => (
                        <li key={replyEntry.id} className="flex gap-2">
                          <CornerDownRightIcon className="text-muted-foreground mt-1 size-3 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <Comment thread={replyEntry} reply />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ),
            )}
          </ol>
        )}

        <div className="space-y-2 border-t pt-4">
          <Textarea placeholder="Leave a comment…" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Comment</Button>
            {toggleHref ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={toggleHref}>
                  {showAll ? "Show this section only" : "Show all activity"}
                </Link>
              </Button>
            ) : null}
          </div>
          {commentsOnly ? null : (
            <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
              Comments ship in Release 1. Browsing the activity history is
              backlog — the release requires the record to exist, not to be
              readable here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
