import { createHmac } from "node:crypto";

/**
 * What proves to Novu that the Inbox asking for `subscriberId`'s notifications
 * was handed that id by us (SPM-174). With HMAC enabled on the environment,
 * Novu refuses an Inbox without it -- otherwise anyone who guessed a
 * `user_account_id` could read that person's notifications.
 *
 * Server-side only: it is keyed with the Novu secret key.
 */
export function subscriberHash(subscriberId: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(subscriberId).digest("hex");
}
