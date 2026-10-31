// Seeds, verifies and tears down the local test data in one command, for end-to-end testing.
//
//   pnpm e2e:data reset    [profile]   supabase db reset, then seed, verify and novu:clear
//   pnpm e2e:data seed     [profile]   tear the profile down, then load its seeds in order
//   pnpm e2e:data verify   [profile]   run its verify.sql and show.sql files; exit 1 on any failure
//   pnpm e2e:data teardown [profile]   run its teardown.sql files in reverse order, then novu:clear
//
// The profile defaults to `full`. Local database only. See scripts/README.md, section 0.

import { spawnSync } from "node:child_process";

// Each step is one seed directory. `seed` files run in order; `verify` is a verify.sql whose
// every row must read ok = true, or a show.sql with the row count it must list.
const step = (dir, { seed = ["seed.sql"], verify, teardown = "teardown.sql" } = {}) => ({
  dir,
  seed,
  verify,
  teardown,
});

const PROFILES = {
  // Every seed that can share a database, in dependency order.
  full: [
    step("seed-coordinator-view", { verify: "verify.sql" }),
    step("seed-venues", { teardown: null }),
    step("seed-venue-search-uat"),
    step("seed-equipment", { verify: "verify.sql" }),
    step("apply-ssot", { seed: [], verify: "verify.sql", teardown: null }),
    step("seed-venue-unavailability", { verify: "verify.sql" }),
    step("seed-booking-holds"),
    step("seed-venue-calendar"),
    step("seed-booking-flags", { verify: { file: "show.sql", rows: 9 } }),
    step("seed-venue-change-flags", { verify: { file: "show.sql", rows: 7 } }),
    step("seed-venue-padding"),
    step("seed-booking-cancel", { verify: "verify.sql" }),
    step("seed-booking-flag-clear", { seed: ["blocks.sql"] }),
    step("seed-event-cancel", { verify: "verify.sql" }),
    step("seed-event-change-flags"),
    step("seed-venue-re-request", { verify: { file: "show.sql", rows: 3 } }),
    step("seed-safety-check", { verify: "verify.sql" }),
    step(".", { seed: [], verify: "e2e-data-stray-flags.sql", teardown: null }),
  ],
  // The Venue hold document's nine booking requests clash with seed-venue-unavailability.
  "venue-hold": [
    step("seed-coordinator-view", { verify: "verify.sql" }),
    step("seed-venues", { teardown: null }),
    step("seed-venue-search-uat"),
    step("seed-equipment", { verify: "verify.sql" }),
    step("seed-booking-holds", { seed: ["seed.sql", "fixture.sql"] }),
  ],
  // The profiles below are the "only" scenarios: their screens list the whole catalogue, so
  // nothing else may be loaded with them.
  "equipment-review": [
    step("seed-equipment-review", { verify: "verify.sql" }),
    step("seed-reschedule-equipment", { verify: "verify.sql" }),
  ],
  "equipment-reserve": [step("seed-equipment-reserve", { verify: "verify.sql" })],
  "venue-search": [step("seed-venue-search-uat")],
};

function query(file) {
  const r = spawnSync(
    "supabase",
    ["db", "query", "--local", "--output-format", "json", "--file", `scripts/${file}`],
    { encoding: "utf8" },
  );
  // A select prints JSON; anything else prints its command tag, such as "DO" or "DELETE 6".
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    out = /^[A-Z]+( \d+)*$/.test(r.stdout.trim()) ? {} : null;
  }
  if (r.status !== 0 || !out || out._tag === "Error") {
    const message = out?.error?.message ?? (r.stdout + r.stderr).trim();
    throw new Error(`${file}: ${message}`);
  }
  return out.rows ?? [];
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  return r.status === 0;
}

function seed(steps) {
  for (const s of steps) {
    for (const f of s.seed) {
      process.stdout.write(`seed      ${s.dir}/${f}\n`);
      query(`${s.dir}/${f}`);
    }
  }
}

function verify(steps) {
  let failed = 0;
  for (const s of steps) {
    if (!s.verify) continue;
    const { file, rows: expected } =
      typeof s.verify === "string" ? { file: s.verify } : s.verify;
    const rows = query(`${s.dir}/${file}`);
    const bad = expected === undefined ? rows.filter((r) => r.ok !== true) : [];
    const countOff = expected !== undefined && rows.length !== expected;
    const ok = rows.length > 0 && bad.length === 0 && !countOff;
    const detail = countOff ? `${rows.length} rows, expected ${expected}` : `${rows.length} rows`;
    process.stdout.write(`${ok ? "ok  " : "FAIL"}      ${s.dir}/${file} (${detail})\n`);
    for (const r of bad) process.stdout.write(`            ${JSON.stringify(r)}\n`);
    if (!ok) failed++;
  }
  return failed === 0;
}

function teardown(steps) {
  for (const s of [...steps].reverse()) {
    if (!s.teardown) continue;
    process.stdout.write(`teardown  ${s.dir}/${s.teardown}\n`);
    query(`${s.dir}/${s.teardown}`);
  }
}

function novuClear() {
  if (!run("pnpm", ["novu:clear"])) {
    process.stdout.write("warning: pnpm novu:clear failed; local Novu subscribers are left behind\n");
  }
}

// After a reset the API comes up before the schema is queryable; wait for it.
function waitForSchema() {
  for (let i = 0; i < 30; i++) {
    const r = spawnSync(
      "supabase",
      ["db", "query", "--local", "--output-format", "json", "select 1 from public.event limit 1"],
      { encoding: "utf8" },
    );
    if (r.status === 0 && !r.stdout.includes('"_tag":"Error"')) return;
    spawnSync("sleep", ["2"]);
  }
  throw new Error("the database was not ready a minute after the reset");
}

const [command, profile = "full"] = process.argv.slice(2);
const steps = PROFILES[profile];
const commands = ["reset", "seed", "verify", "teardown"];
if (!commands.includes(command) || !steps) {
  process.stderr.write(
    `usage: pnpm e2e:data <${commands.join("|")}> [${Object.keys(PROFILES).join("|")}]\n`,
  );
  process.exit(2);
}

try {
  let ok = true;
  if (command === "reset") {
    if (!run("supabase", ["db", "reset"])) throw new Error("supabase db reset failed");
    waitForSchema();
  }
  // Not every seed is safe to re-run on top of the others, so `seed` starts from a teardown.
  if (command === "seed") teardown(steps);
  if (command === "reset" || command === "seed") seed(steps);
  if (command === "reset" || command === "verify") ok = verify(steps);
  if (command === "teardown") teardown(steps);
  if (command === "reset" || command === "teardown") novuClear();
  process.exit(ok ? 0 : 1);
} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(1);
}
