// SPM-19 AC7: two approvals race for padded-overlapping times, and only one may succeed.
// "Race A" (10:00-12:00) and "Race B" (12:15-14:00) on Saturday 19 December
// 2026 at Main Hall do not touch, but A's turnaround (to 12:45) runs into B's setup (from 11:45).
// This starts both approvals at the same moment in two database sessions.
//
// Needs seed.sql loaded. It really approves one of the two, so run seed.sql again afterwards:
//   node scripts/seed-venue-padding/race.mjs
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const psql = (sql) =>
  run("docker", ["exec", "supabase_db_connectsphere", "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql]);

const query = async (sql) => (await psql(sql)).stdout.trim();
const staff = await query(
  "select ua.user_account_id from user_account ua join auth.users u on u.id = ua.auth_user_id where u.email = 'venue@test.com'",
);
const idOf = (name) =>
  query(`select b.booking_id from booking b join event e using (event_id) where e.name = '${name}'`);
const [a, b] = [await idOf("Race A"), await idOf("Race B")];
if (!a || !b) {
  console.log("FAILED: run seed.sql first");
  process.exit(1);
}

const approve = (id) => psql(`select public.venue_staff_decide_booking(${staff}, ${id}, 'approve', null, null)`);
const outcomes = await Promise.allSettled([approve(a), approve(b)]);

const succeeded = outcomes.filter((o) => o.status === "fulfilled").length;
const refused = outcomes.filter(
  (o) => o.status === "rejected" && /setup or turnaround time/.test(`${o.reason.stderr}`),
).length;
const states = await query(
  `select string_agg(e.name || '=' || b.status, ', ' order by e.name) from booking b join event e using (event_id) where b.booking_id in (${a}, ${b})`,
);

const ok = succeeded === 1 && refused === 1;
console.log(ok ? `ok: one approval succeeded and one was refused (${states})` : `FAILED: ${succeeded} succeeded, ${refused} refused (${states})`);
process.exit(ok ? 0 : 1);
