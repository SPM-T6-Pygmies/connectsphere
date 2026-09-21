import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { ReactNode } from "react";

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
  ACTING_AS,
  type CommentThread,
  type FeedRow,
  type StaffRole,
  type SystemActivity,
} from "@/lib/wireframe";

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

/** A same-size node for a system activity row, so it sits on the timeline rail beside comment avatars. */
function ActivityIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
      <Icon className="size-3" />
    </span>
  );
}

const GOOD_VALUES = new Set([
  "Approved",
  "Confirmed",
  "Reserved",
  "Completed",
  "Done",
]);
const BAD_VALUES = new Set(["Rejected", "Cancelled", "Unavailable", "Withdrawn"]);

/** No field -> a plain thing-happened marker; otherwise read the outcome from what it changed to. */
function activityIcon(entry: SystemActivity): LucideIcon {
  if (!entry.field || !entry.to) return CircleDotIcon;
  if (GOOD_VALUES.has(entry.to)) return CheckCircle2Icon;
  if (BAD_VALUES.has(entry.to)) return XCircleIcon;
  return ArrowRightIcon;
}

/** How many things people said, across threads and their replies. */
function commentsIn(rows: readonly FeedRow[]): number {
  return rows.reduce(
    (total, row) => (row.kind === "thread" ? total + 1 + row.thread.replies.length : total),
    0,
  );
}

/** "3d ago", falling back gracefully for anything outside a day/month/year window. */
function timeAgo(timestamp: string): string {
  const then = new Date(timestamp.replace(" ", "T")).getTime();
  const diffMs = Math.max(0, Date.now() - then);
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

function Timestamp({ at }: { at: string }) {
  return (
    <span className="text-muted-foreground text-xs" title={at}>
      {timeAgo(at)}
    </span>
  );
}

function Comment({
  thread,
  reply = false,
  replyComposer,
}: {
  thread: CommentThread["entry"];
  reply?: boolean;
  /** The real reply box for this message, when the surface has one. */
  replyComposer?: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Avatar name={thread.actor.name} className={reply ? "size-5" : "size-6"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{thread.actor.name}</span>
          <Timestamp at={thread.at} />
        </div>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{thread.body}</p>
        {reply ? null : replyComposer === undefined ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-1 text-xs font-medium"
          >
            Reply
          </button>
        ) : (
          // `details` rather than client state: the box opens with no
          // JavaScript, which keeps the whole rail a server component.
          <details className="group mt-1">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-xs font-medium">
              Reply
            </summary>
            <div className="mt-2">{replyComposer}</div>
          </details>
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
 * answer interleaves the two. Every row -- activity or comment -- sits on one
 * continuous timeline rail, the way Linear's activity view reads as a single
 * thread rather than separate sections.
 *
 * Scoped to the section it sits on, with a link to the whole event's trail --
 * the Venue tab wants the venue's story, not every status change the event
 * has ever had.
 *
 * The rows are supplied rather than looked up here. The wireframe surfaces
 * still pass `feedRows(activityFor(...))`; the real request-detail surfaces
 * (SPM-33) pass a clarification thread resolved by a use case in the page,
 * which they have to -- `src/lib` is lint-forbidden from importing `@/core`,
 * so real data could never have reached a panel that fetched its own.
 */
export function ActivityPanel({
  rows,
  role,
  showAll = false,
  toggleHref,
  /** Comments only, for the external organiser: no internal activity. */
  commentsOnly = false,
  title,
  description,
  actingAsName,
  composer,
  replyComposer,
}: {
  rows: readonly FeedRow[];
  role: StaffRole;
  showAll?: boolean;
  toggleHref?: string;
  commentsOnly?: boolean;
  /** Overrides the heading, for a surface whose feed is not the event's own trail. */
  title?: string;
  /** Overrides the standfirst, so each side of an exchange reads in its own voice. */
  description?: string;
  /** Who the viewer is. Falls back to the wireframe persona for the fixture surfaces. */
  actingAsName?: string;
  /**
   * The real box for starting a new message. Omitted on the wireframe
   * surfaces, which keep the placeholder and its "comments ship in Release 1"
   * note.
   */
  composer?: ReactNode;
  /** A reply box for one top-level message, rendered under it when opened. */
  replyComposer?: (parentId: string) => ReactNode;
}) {
  const comments = commentsIn(rows);
  const actingAs = { name: actingAsName ?? ACTING_AS[role].name };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? (commentsOnly ? "Discussion" : "Activity")}</CardTitle>
        <CardDescription>
          {description ??
            (commentsOnly
              ? "Questions and answers between you and your coordinator, kept with the event."
              : showAll
                ? "Everything recorded against this event."
                : `What has happened on this section — ${comments} comment${comments === 1 ? "" : "s"}.`)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing here yet.</p>
        ) : (
          <div className="relative">
            <div
              aria-hidden
              className="bg-border absolute top-3 bottom-3 left-3 w-px"
            />
            <ol className="space-y-5">
              {rows.map((row) =>
                row.kind === "activity" ? (
                  <li key={row.entry.id} className="relative flex gap-3 text-sm">
                    <ActivityIcon icon={activityIcon(row.entry)} />
                    <span className="text-muted-foreground min-w-0 pt-0.5">
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
                      ) : null}{" "}
                      <Timestamp at={row.entry.at} />
                    </span>
                  </li>
                ) : (
                  <li key={row.thread.entry.id} className="relative space-y-3">
                    <Comment
                      thread={row.thread.entry}
                      replyComposer={replyComposer?.(row.thread.entry.id)}
                    />
                    {row.thread.replies.length > 0 ? (
                      <ul className="border-border ml-3 space-y-3 border-l pl-4">
                        {row.thread.replies.map((replyEntry) => (
                          <li key={replyEntry.id}>
                            <Comment thread={replyEntry} reply />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ),
              )}
            </ol>
          </div>
        )}

        <div className="flex gap-3 border-t pt-4">
          <Avatar name={actingAs.name} />
          <div className="min-w-0 flex-1 space-y-2">
            {composer ?? (
              <>
                <Textarea placeholder="Leave a comment…" />
                <Button size="sm">Comment</Button>
              </>
            )}
            {toggleHref ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={toggleHref}>
                  {showAll ? "Show this section only" : "Show all activity"}
                </Link>
              </Button>
            ) : null}
            {commentsOnly || composer ? null : (
              <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
                Comments ship in Release 1. Browsing the activity history is
                backlog — the release requires the record to exist, not to be
                readable here.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
