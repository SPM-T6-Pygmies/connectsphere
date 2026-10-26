// SPM-19 AC7: runs scripts/seed-venue-padding/cases.json through the database's
// `booking_padded_clashes` and fails if its answers differ from the list. The same cases are run
// through the code by src/core/domain/padded-window-cases.test.ts, so the two copies of the
// padded-window rule cannot drift apart unnoticed.
//
// Needs a local stack with the base seed, seed-venues and seed-venue-search-uat:
//   node scripts/seed-venue-padding/same-answers.mjs
//
// Each case is built and rolled back inside the database; nothing is kept.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));

const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const firstSlot = (time) => minutes(time) / 15;
const lastSlot = (time) => minutes(time) / 15 - 1;
const quote = (text) => `'${text.replaceAll("'", "''")}'`;

const caseBlock = (c, index) => `
    begin
      select venue_id into v_venue from public.venue where location = ${quote(c.venue)};
      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
        values (v_venue, v_event_a, v_coord) returning booking_id into v_a;
      insert into public.booking_slot (booking_id, slot_date, slot)
        select v_a, date ${quote(c.existing.date)}, n::text from generate_series(${firstSlot(c.existing.start)}, ${lastSlot(c.existing.end)}) n;
      update public.booking set status = ${quote(c.existing.status)}, decided_by_user_account_id = v_staff,
        hold_expires_at = ${c.existing.status === "Tentative Hold" ? "now() + interval '1 day'" : "null"}
        where booking_id = v_a;
      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
        values (v_venue, v_event_b, v_coord) returning booking_id into v_b;
      insert into public.booking_slot (booking_id, slot_date, slot)
        select v_b, date ${quote(c.request.date)}, n::text from generate_series(${firstSlot(c.request.start)}, ${lastSlot(c.request.end)}) n;
      select coalesce(jsonb_agg(jsonb_build_object('date', clash_date::text, 'start', to_char(clash_start, 'HH24:MI'),
               'end', case when clash_end = time '24:00' then '24:00' else to_char(clash_end, 'HH24:MI') end)
               order by clash_date, clash_start), '[]'::jsonb)
        into v_found from public.booking_padded_clashes(v_b);
      v_checks := v_checks + 1;
      if v_found <> ${quote(JSON.stringify(c.clashes))}::jsonb then
        v_failed := array_append(v_failed, ${quote(`case ${index + 1} (${c.label})`)} || ': the database gave ' || v_found::text);
      end if;
      raise exception 'rolled back' using errcode = 'CS999';
    exception when sqlstate 'CS999' then
      null;
    end;`;

const sql = `do $$
declare
  v_staff bigint; v_coord bigint; v_event_a bigint; v_event_b bigint;
  v_venue bigint; v_a bigint; v_b bigint; v_found jsonb;
  v_failed text[] := '{}'; v_checks int := 0;
begin
  select user_account_id into v_staff from public.user_account where name = 'Test Venue Staff' and client_organisation_id is null;
  select user_account_id into v_coord from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select event_id into v_event_a from public.event where name = 'UAT-44 Booked Harbour';
  select event_id into v_event_b from public.event where name = 'UAT-44 Rejected Garden';
  if v_staff is null or v_coord is null or v_event_a is null or v_event_b is null then
    raise exception 'Run the base seed, seed-venues and seed-venue-search-uat first';
  end if;
${cases.map(caseBlock).join("\n")}
  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % cases give the same answer as the code', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;`;

const file = join(tmpdir(), "padded-same-answers.sql");
writeFileSync(file, sql);
let output = "";
try {
  output = execFileSync("supabase", ["db", "query", "--file", file, "--local"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
}
const result = output.match(/error: (ok: .*?|FAILED: .*?)"/s)?.[1] ?? output.trim();
console.log(result);
process.exit(result.startsWith("ok:") ? 0 : 1);
