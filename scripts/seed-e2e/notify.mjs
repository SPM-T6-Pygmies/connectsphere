// Sends five real notifications for the e2e data, one per staff role, so bells are not empty on
// a fresh database. The bell reads Novu; the `notification` table is only a delivery log, so a
// row alone would never appear there. Each one also gets the Sent row the app would have written.
//
//   pnpm novu:seed            (pnpm e2e:data reset, seed and notify run it for you)
//
// Locally, Novu runs a workflow by calling this app's bridge, so the dev server must be up
// (pnpm dev:local). Without it, or without the Novu settings, this warns and exits 0:
// `pnpm e2e:data notify` sends them once the server is running.
//
// With --remote it reads the linked database and sends to Novu's Production environment, where the
// workflows are synced and subscriber ids have no prefix, so no tunnel is needed. Run it through
// `pnpm e2e:data notify --remote`, which asks for the project's ref first.
//
// Payloads mirror each workflow's payloadSchema in src/adapters/outbound/novu/workflows. A plain
// .mjs cannot import those types, so a schema change shows up here as a failed step in Novu.

import { spawnSync } from "node:child_process";
import { userInfo } from "node:os";

import { Novu } from "@novu/api";

const remote = process.argv.includes("--remote");

function skip(reason) {
  console.log(`Skipped the seeded notifications: ${reason} Run pnpm e2e:data notify once it is.`);
  process.exit(0);
}

function query(sql) {
  const r = spawnSync("supabase", ["db", "query", remote ? "--linked" : "--local", "--output-format", "json", sql], {
    encoding: "utf8",
  });
  // A select prints JSON; anything else prints its command tag, such as "INSERT 0 1".
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    out = /^[A-Z]+( \d+)*$/.test(r.stdout.trim()) ? [] : null;
  }
  if (r.status !== 0 || !out || out._tag === "Error") {
    throw new Error(out?.error?.message ?? (r.stdout + r.stderr).trim());
  }
  // The CLI prints a bare array of rows, or wraps them in { rows } when it detects an AI agent.
  return Array.isArray(out) ? out : out.rows;
}

// The tunnel URL lives in .env.local, the way the app reads it; Infisical supplies the key.
if (!remote) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No such file: the check below reports what is missing.
  }
}

const secretKey = process.env.NOVU_SECRET_KEY;
const bridgeUrl = remote ? undefined : process.env.NOVU_BRIDGE_URL;
if (!secretKey) skip("NOVU_SECRET_KEY is not set.");

if (!remote) {
  if (!bridgeUrl) skip("NOVU_BRIDGE_URL is not set.");
  const healthy = await fetch(`${bridgeUrl}?action=health-check`, { signal: AbortSignal.timeout(10_000) })
    .then((response) => response.ok)
    .catch(() => false);
  if (!healthy) skip(`the Novu bridge at ${bridgeUrl} is not answering (pnpm dev:local is not running?).`);
}

const [ids] = query(`
  select
    (select user_account_id::text from public.user_account where name = 'Test Coordinator') as coordinator,
    (select user_account_id::text from public.user_account where name = 'Test Venue Staff') as venue_staff,
    (select user_account_id::text from public.user_account where name = 'Test Safety Officer') as safety,
    (select user_account_id::text from public.user_account where name = 'Test Support Staff') as support,
    (select user_account_id::text from public.user_account where name = 'Test Organiser 2') as organiser,
    (select event_request_id::text from public.event_request where event_name = 'Customer Advisory Day') as assigned_request,
    (select event_request_id::text from public.event_request where event_name = 'Rooftop Product Launch') as rejected_request,
    (select decision_record from public.event_request where event_name = 'Rooftop Product Launch') as rejection,
    (select event_id::text from public.event where name = 'Winter Networking Mixer') as mixer,
    (select event_id::text from public.event where name = 'Client Appreciation Dinner') as dinner,
    (select b.booking_id::text from public.booking b join public.event e on e.event_id = b.event_id
      where e.name = 'Winter Networking Mixer') as mixer_booking
`);
if (!ids.mixer || !ids.assigned_request) throw new Error("The e2e data is not loaded; run pnpm e2e:data reset.");

const notices = [
  {
    workflowId: "coordinator-assigned",
    scenario: "coordinator-assigned",
    relatedColumn: "related_event_request_id",
    relatedId: ids.assigned_request,
    message: "New assignment: Customer Advisory Day",
    payload: {
      audience: "coordinator",
      recipientUserAccountId: ids.coordinator,
      eventRequestId: ids.assigned_request,
      eventName: "Customer Advisory Day",
      clientOrganisationName: "Test Organisation",
      preferredDate: "2026-12-07",
      preferredStartTime: "10:00",
      preferredEndTime: "15:00",
    },
  },
  {
    workflowId: "venue-booking-requested",
    scenario: "venue-booking-requested",
    relatedColumn: "related_booking_id",
    relatedId: ids.mixer_booking,
    message: "Booking requested: Winter Networking Mixer at Rooftop Terrace",
    payload: {
      recipientUserAccountId: ids.venue_staff,
      bookingId: ids.mixer_booking,
      eventName: "Winter Networking Mixer",
      venueLocation: "Rooftop Terrace",
      times: [{ date: "2026-12-08", start: "18:00", end: "21:00" }],
    },
  },
  {
    workflowId: "safety-check-ready",
    scenario: "safety-check-ready",
    relatedColumn: "related_event_id",
    relatedId: ids.dinner,
    message: "Ready for safety check: Client Appreciation Dinner",
    payload: {
      recipientUserAccountId: ids.safety,
      eventId: ids.dinner,
      eventName: "Client Appreciation Dinner",
      preferredDate: "2026-12-12",
      venues: ["Main Hall"],
      equipmentLines: 1,
    },
  },
  {
    workflowId: "equipment-needs-attention",
    scenario: "equipment-needs-attention",
    relatedColumn: "related_event_id",
    relatedId: ids.mixer,
    message: "Equipment recorded: Winter Networking Mixer, 2 PA speaker",
    payload: {
      recipientUserAccountId: ids.support,
      eventId: ids.mixer,
      eventName: "Winter Networking Mixer",
      preferredDate: "2026-12-08",
      equipmentType: "PA speaker",
      change: "added",
      quantityRequested: 2,
      quantityWas: null,
      attention: "new",
    },
  },
  {
    workflowId: "event-request-decided",
    scenario: "event-request-decided",
    relatedColumn: "related_event_request_id",
    relatedId: ids.rejected_request,
    message: "Request rejected: Rooftop Product Launch",
    payload: {
      recipientUserAccountId: ids.organiser,
      eventRequestId: ids.rejected_request,
      eventName: "Rooftop Product Launch",
      decision: "rejected",
      decisionRecord: ids.rejection,
    },
  },
];

const novu = new Novu({ secretKey });
// Keep in step with src/composition/novu-subscriber.ts: a deployment's ids have no prefix.
const prefix = remote ? "" : `${userInfo().username}-`;
let failed = 0;

for (const notice of notices) {
  const { recipientUserAccountId: recipient } = notice.payload;
  let status = "Sent";
  try {
    const { result } = await novu.trigger({
      workflowId: notice.workflowId,
      to: `${prefix}${recipient}`,
      payload: notice.payload,
      bridgeUrl,
    });
    if (!result.acknowledged || result.status !== "processed") throw new Error(result.status);
    console.log(`sent      ${notice.workflowId} to ${prefix}${recipient}`);
  } catch (error) {
    status = "Failed";
    failed++;
    console.error(`FAILED    ${notice.workflowId}: ${error.message}`);
  }

  // Replaces an earlier run's row, so sending again does not pile up the log. The values are all
  // ids and the constants above, none of which holds a quote.
  query(`
    with earlier as (
      delete from public.notification
      where recipient_user_account_id = ${recipient}
        and trigger_scenario = '${notice.scenario}'
        and ${notice.relatedColumn} = ${notice.relatedId}
    )
    insert into public.notification (
      recipient_user_account_id, trigger_scenario, channel, status, sent_at, message_content, ${notice.relatedColumn}
    )
    values (
      ${recipient}, '${notice.scenario}', 'in_app', '${status}',
      ${status === "Sent" ? "now()" : "null"}, '${notice.message}', ${notice.relatedId}
    )
  `);
}

process.exit(failed === 0 ? 0 : 1);
