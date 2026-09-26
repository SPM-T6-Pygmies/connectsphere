import { userInfo } from "node:os";

/**
 * What goes before a `user_account_id` to make it a Novu subscriber id (SPM-178).
 *
 * Nothing on a deployment. Locally, the developer's own username: every local
 * database has the same account ids and every local session shares Novu's
 * Development environment, so without it all of us would read one inbox --
 * and, after a `db reset` reuses request ids, notifications that point at
 * the wrong request. `scripts/novu-clear.mjs` clears exactly this prefix, so
 * keep the two in step.
 */
export function novuSubscriberPrefix(): string {
  return process.env.NODE_ENV === "production" ? "" : `${userInfo().username}-`;
}
