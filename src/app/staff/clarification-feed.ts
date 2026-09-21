import type { ClarificationMessageView } from "@/core/use-cases/event-request-view";
import { feedRows, type ActivityEntry, type FeedRow } from "@/lib/wireframe";

/**
 * A request's clarification thread, in the shape `ActivityPanel` renders
 * (SPM-33 AC4).
 *
 * The translation lives in `src/app` because it is the route's job -- parse,
 * call a use case, translate the result. It cannot live in `src/lib/wireframe`
 * alongside the feed types, which is lint-forbidden from importing `@/core`,
 * and it must not live in the core, which does not know a panel exists.
 *
 * `section` is `"overview"`: a clarification is about the request as a whole,
 * not about its venue or its equipment. It is carried only because the feed
 * types are shared with the event surfaces, which do scope by section.
 */
export function clarificationFeedRows(
  eventRequestId: string,
  messages: readonly ClarificationMessageView[],
): FeedRow[] {
  const entries: ActivityEntry[] = messages.map((message) => ({
    id: message.id,
    eventId: eventRequestId,
    section: "overview",
    kind: "comment",
    actor: {
      // The panel only ever reads the name; the rest of `Person` is the
      // wireframe's own shape and has no counterpart on a stored message.
      id: message.id,
      name: message.authorName,
      department: null,
      clientOrganisation: null,
    },
    at: message.postedAt,
    body: message.body,
    parentId: message.parentId,
  }));

  return feedRows(entries);
}
