// Deletes your own local Novu subscribers, and their notifications, from
// Novu's Development environment (SPM-178). Run it whenever you wipe local
// data -- `teardown.sql`, `supabase db reset` -- since Postgres cannot
// cascade into Novu, and otherwise the old notifications stay in your inbox
// pointing at request ids the reset has reused.
//
//   pnpm novu:clear
//
// Only subscribers carrying your prefix are touched, never a teammate's or
// Production's: locally the app sends to `<username>-<user_account_id>`
// (see src/composition/novu-subscriber.ts -- keep the prefix in step).

import { userInfo } from "node:os";

import { Novu } from "@novu/api";

const secretKey = process.env.NOVU_SECRET_KEY;
if (!secretKey) {
  console.error("NOVU_SECRET_KEY is not set. Run this through `pnpm novu:clear`.");
  process.exit(1);
}

const prefix = `${userInfo().username}-`;
const novu = new Novu({ secretKey });

const ids = [];
let after;
do {
  // Search on subscriberId is exact-match only, so page through them all.
  const { result } = await novu.subscribers.search({ limit: 100, after });
  ids.push(...result.data.map((s) => s.subscriberId).filter((id) => id.startsWith(prefix)));
  after = result.next ?? undefined;
} while (after);

for (const id of ids) {
  await novu.subscribers.delete(id);
  console.log(`deleted ${id}`);
}
console.log(`Cleared ${ids.length} local subscriber${ids.length === 1 ? "" : "s"} (${prefix}*).`);
