#!/usr/bin/env node
/**
 * Per-domain test report and registry keeper.
 *
 * The registry (docs/tests/test-registry.csv) is the test-case *specification*:
 * one row per case, regenerated from a real vitest run so it cannot drift, with
 * the human columns (TestID, Ticket, AC, ExpectedResult, Notes) preserved across
 * regenerations. The run ledger (docs/tests/test-runs.csv) is the *execution
 * record*: one row per green merge to main, because a passing case is only ever
 * passing as of that build.
 *
 *   pnpm test:report            print the per-domain table
 *   pnpm test:report --check    ...and fail if the committed registry is stale
 *   pnpm test:report --update   ...and rewrite the registry, keeping annotations
 *   pnpm test:report --record   ...and stamp Pass + append a run row (CI, main)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = path.join(ROOT, "docs", "tests");
const REGISTRY = path.join(TESTS_DIR, "test-registry.csv");
const RUNS = path.join(TESTS_DIR, "test-runs.csv");
const DOMAINS = path.join(TESTS_DIR, "domains.json");
const TICKETS = path.join(TESTS_DIR, "tickets.json");

// Ordered to mirror the IS212 test case template: the specification fields
// first (written once), then the execution record (one per run).
const COLUMNS = [
  "TestID", "Domain", "Quadrant", "Source", "Ticket", "TicketTitle", "UserStory", "AC",
  "File", "Suite", "TestCase",
  "Preconditions", "TestSteps", "TestData", "ExpectedResult",
  "CreatedBy", "DateCreated",
  "ActualResult", "Status", "Remarks", "ExecutedBy", "LastPassedCommit", "LastPassedDate",
];

// Every automated test here plugs fakes into ports -- no database, no network,
// no framework, and not a single beforeEach in the suite. That makes the
// precondition identical for all of them, and worth stating rather than leaving
// the column blank.
const AUTO_PRECONDITION = "None - the test builds its own in-memory fixtures";
const RUN_COLUMNS = [
  "RunDate", "Commit", "PR", "Branch", "TotalCases", "Passed", "Failed",
  "DurationSeconds", "DomainBreakdown", "ExecutedBy",
];

/* ---------------------------------------------------------------- CSV (RFC 4180) */

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === '"') { quoted = true; i += 1; continue; }
    if (c === ",") { row.push(field); field = ""; i += 1; continue; }
    if (c === "\r") { i += 1; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i += 1; continue; }
    field += c; i += 1;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toCsv(rows) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

/** Read a CSV whose first row is a header into objects keyed by column name. */
function readTable(file, columns) {
  if (!existsSync(file)) return [];
  const rows = parseCsv(readFileSync(file, "utf8"));
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(columns.map((c) => [c, r[header.indexOf(c)] ?? ""])));
}

const writeTable = (rows, columns) =>
  toCsv([columns, ...rows.map((r) => columns.map((c) => r[c] ?? ""))]);

/* ---------------------------------------------------------------- the test run */

function runVitest() {
  const out = path.join(tmpdir(), `vitest-report-${process.pid}.json`);
  const bin = path.join(ROOT, "node_modules", ".bin", "vitest");
  const result = spawnSync(bin, ["run", "--includeTaskLocation", "--reporter=json", `--outputFile=${out}`], {
    cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  if (!existsSync(out)) {
    console.error(result.stderr || result.stdout || "vitest produced no report");
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(out, "utf8"));
  rmSync(out, { force: true });

  const cases = [];
  for (const file of report.testResults) {
    const relative = path.relative(ROOT, file.name).split(path.sep).join("/");
    for (const a of file.assertionResults) {
      cases.push({
        file: relative,
        line: a.location?.line ?? 0,
        suite: (a.ancestorTitles ?? []).join(" > "),
        testCase: a.title,
        passed: a.status === "passed",
        status: a.status,
        failureMessages: a.failureMessages ?? [],
      });
    }
  }
  return { cases, durationMs: Date.now() - report.startTime };
}

/* ---------------------------------------------------------------- the registry */

/**
 * A case's identity, ignoring any ticket tag written into the names. Re-tracing
 * a test to a different ticket must not read as deleting one test and adding
 * another -- the tag is metadata about the case, not part of which case it is.
 */
const untag = (s) => (s ?? "").replace(/\s*\((SPM-\d+)\)/g, "");
const keyOf = (r) =>
  [r.file ?? r.File, untag(r.suite ?? r.Suite), untag(r.testCase ?? r.TestCase)].join("\u0000");

/**
 * Who wrote each line of a test file, and when. The template asks for Created By
 * and Date of Creation; git already knows both, so nobody has to type them.
 * Line numbers are used here and then thrown away -- storing them would make the
 * registry churn every time an unrelated line moved.
 */
const blameCache = new Map();
function blameFor(file) {
  if (blameCache.has(file)) return blameCache.get(file);
  const out = spawnSync("git", ["blame", "--porcelain", "--", file],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout ?? "";
  const commits = new Map();
  const shaByLine = new Map();
  let sha = null;
  for (const line of out.split("\n")) {
    const header = /^([0-9a-f]{40}) \d+ (\d+)/.exec(line);
    if (header) { sha = header[1]; shaByLine.set(Number(header[2]), sha); continue; }
    if (!sha) continue;
    const commit = commits.get(sha) ?? {};
    if (line.startsWith("author ")) commit.author = line.slice(7);
    else if (line.startsWith("author-time ")) commit.date = new Date(Number(line.slice(12)) * 1000).toISOString().slice(0, 10);
    commits.set(sha, commit);
  }
  const byLine = new Map();
  for (const [ln, s] of shaByLine) byLine.set(ln, commits.get(s) ?? {});
  blameCache.set(file, byLine);
  return byLine;
}

function loadDomains() {
  if (!existsSync(DOMAINS)) return [];
  return JSON.parse(readFileSync(DOMAINS, "utf8"));
}

/**
 * Resolve a case's ticket from the tags written into the test names, innermost
 * first: an it() tag beats its describe, which beats the describe above it.
 * Putting the tag in the code rather than only in this CSV means a renamed or
 * moved test carries its ticket with it, and the tag is reviewed in the PR that
 * adds the test.
 */
function ticketFor(suite, testCase, tickets) {
  const blocks = [...suite.split(" > "), testCase];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const found = /\b(SPM-\d+)\b/.exec(blocks[i]);
    if (!found) continue;
    const id = found[1];
    const issue = tickets[id];
    return { Ticket: id, TicketTitle: issue?.title ?? "", UserStory: issue?.parent ?? id };
  }
  return { Ticket: "", TicketTitle: "", UserStory: "" };
}

function domainFor(file, domains) {
  for (const d of domains) if (d.match.some((m) => file.includes(m))) return d.domain;
  return "Unmapped";
}

/**
 * Merge a test run into the existing registry rows.
 *
 * Surviving auto rows keep every human column *and* their recorded status, so a
 * regeneration is a no-op unless the suite itself changed. A case the run no
 * longer reports is marked Retired rather than dropped, so a deleted test shows
 * up in the PR diff. Manual rows are passed through untouched.
 */
function buildRegistry(existing, cases, domains, tickets) {
  const byKey = new Map(existing.filter((r) => r.Source !== "manual").map((r) => [keyOf(r), r]));
  // Manual rows keep their hand-set Ticket, but still get the title and parent
  // user story filled in from the ticket map.
  const manual = existing.filter((r) => r.Source === "manual").map((r) => {
    const issue = tickets[r.Ticket];
    return issue ? { ...r, TicketTitle: issue.title, UserStory: issue.parent ?? r.Ticket } : r;
  });

  const seen = new Set();
  const rows = [];

  for (const c of cases) {
    const key = keyOf(c);
    seen.add(key);
    const prior = byKey.get(key);
    // Authorship is settled once, like the id: re-blaming a moved line would
    // credit whoever last touched the file rather than whoever wrote the test.
    const authored = prior?.CreatedBy ? prior : blameFor(c.file).get(c.line) ?? {};
    rows.push({
      TestID: prior?.TestID ?? "",
      Domain: domainFor(c.file, domains),
      Quadrant: prior?.Quadrant || "Q1",
      Source: "auto",
      ...ticketFor(c.suite, c.testCase, tickets),
      AC: prior?.AC ?? "",
      File: c.file,
      Suite: c.suite,
      TestCase: c.testCase,
      Preconditions: prior?.Preconditions || AUTO_PRECONDITION,
      // The -- matters: without it pnpm swallows -t and the whole file runs.
      TestSteps: `pnpm test -- ${c.file} -t ${JSON.stringify(c.testCase)}`,
      TestData: prior?.TestData ?? "",
      ExpectedResult: prior?.ExpectedResult ?? "",
      CreatedBy: prior?.CreatedBy || authored.author || authored.CreatedBy || "",
      DateCreated: prior?.DateCreated || authored.date || authored.DateCreated || "",
      ActualResult: prior?.ActualResult ?? "",
      Status: prior?.Status || "Not Executed",
      Remarks: prior?.Remarks ?? "",
      ExecutedBy: prior?.ExecutedBy ?? "",
      LastPassedCommit: prior?.LastPassedCommit ?? "",
      LastPassedDate: prior?.LastPassedDate ?? "",
    });
  }

  for (const [key, row] of byKey) {
    if (!seen.has(key)) rows.push({ ...row, Status: "Retired" });
  }

  const order = new Map(domains.map((d, i) => [d.domain, i]));
  const rank = (r) => (order.has(r.Domain) ? order.get(r.Domain) : domains.length);
  const sorted = [...rows, ...manual].sort((a, b) =>
    rank(a) - rank(b) ||
    (a.Domain).localeCompare(b.Domain) ||
    a.Source.localeCompare(b.Source) ||
    a.File.localeCompare(b.File) ||
    a.Suite.localeCompare(b.Suite) ||
    a.TestCase.localeCompare(b.TestCase));

  // IDs are handed out after the sort, so a fresh registry reads in order and an
  // existing one keeps every ID it already had. Retired IDs are never reused.
  let nextId = existing.reduce((max, r) => {
    const m = /^UT-(\d+)$/.exec(r.TestID ?? "");
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  for (const row of sorted) {
    if (!row.TestID) row.TestID = `UT-${String(++nextId).padStart(4, "0")}`;
  }

  return sorted;
}

/* ---------------------------------------------------------------- the report */

function summarise(cases, rows, domains) {
  const idByKey = new Map(rows.map((r) => [keyOf(r), r.TestID]));
  const names = [...domains.map((d) => d.domain), "Unmapped"];
  const groups = new Map(names.map((n) => [n, { name: n, total: 0, passed: 0, failures: [], manual: 0 }]));

  for (const c of cases) {
    const name = domainFor(c.file, domains);
    if (!groups.has(name)) groups.set(name, { name, total: 0, passed: 0, failures: [], manual: 0 });
    const g = groups.get(name);
    g.total += 1;
    if (c.passed) g.passed += 1;
    else g.failures.push({ ...c, testId: idByKey.get(keyOf(c)) ?? "—" });
  }
  for (const r of rows) {
    if (r.Source === "manual" && groups.has(r.Domain)) groups.get(r.Domain).manual += 1;
  }
  return [...groups.values()].filter((g) => g.total > 0 || g.manual > 0);
}

function printReport(groups, cases, rows) {
  const total = cases.length;
  const passed = cases.filter((c) => c.passed).length;
  // The chain is user story -> AC -> test case. Report the two links separately:
  // a ticket is easy to attach and nearly done, an AC is the real remaining gap.
  const live = rows.filter((r) => r.Status !== "Retired");
  const noTicket = live.filter((r) => !r.Ticket).length;
  const noAC = live.filter((r) => r.Ticket && !r.AC).length;
  const width = Math.max(...groups.map((g) => g.name.length), 10);

  console.log(`\nTest report · ${total} cases · ${groups.length} domains\n`);
  for (const g of groups) {
    const ok = g.failures.length === 0;
    const counts = `${String(g.passed).padStart(4)}/${String(g.total).padEnd(4)}`;
    const manual = g.manual > 0 ? `  · ${g.manual} manual` : "";
    console.log(`  ${ok ? "✔" : "✖"} ${g.name.padEnd(width)} ${counts} auto${manual}`);
    for (const f of g.failures) {
      console.log(`      ✖ ${f.testId}  ${f.suite ? f.suite + " > " : ""}${f.testCase}`);
      console.log(`                 ${f.file}`);
    }
  }
  const parts = [`${passed}/${total} passed`];
  if (total - passed > 0) parts.push(`${total - passed} failing`);
  if (rows.length > 0) {
    parts.push(`${live.length - noTicket}/${live.length} traced to a ticket`);
    if (noAC > 0) parts.push(`${noAC} still need an AC`);
  }
  console.log(`\n${parts.join(" · ")}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `### Test report — ${passed}/${total} passed`, "",
      "| | Domain | Auto | Manual |", "|---|---|---|---|",
      ...groups.map((g) => `| ${g.failures.length === 0 ? "✅" : "❌"} | ${g.name} | ${g.passed}/${g.total} | ${g.manual || "—"} |`),
    ];
    for (const g of groups) {
      for (const f of g.failures) lines.push("", `**${f.testId}** \`${f.file}\` — ${f.suite} > ${f.testCase}`);
    }
    if (rows.length > 0) {
      lines.push("", `Traceability: ${live.length - noTicket}/${live.length} cases carry a ticket; ${noAC} of those still need an acceptance criterion.`);
    }
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  }
}

/* ---------------------------------------------------------------- run record */

const git = (...args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" }).stdout.trim();

function recordRun(rows, groups, cases, durationMs) {
  const commit = process.env.GITHUB_SHA || git("rev-parse", "HEAD");
  const branch = process.env.GITHUB_REF_NAME || git("rev-parse", "--abbrev-ref", "HEAD");
  const pr = /Merge pull request #(\d+)/.exec(git("log", "-1", "--pretty=%B"))?.[1] ?? "";
  const date = new Date().toISOString().slice(0, 10);

  const runBy = process.env.GITHUB_RUN_ID
    ? `CI run ${process.env.GITHUB_RUN_ID}`
    : `${git("config", "user.name") || "local"} (local)`;

  // Only the per-case outcome is stamped here. Who ran it, at which commit and
  // when describe the *run*, and the whole suite runs at once -- copying them
  // onto every row would write one fact 368 times and rewrite the file on every
  // merge. They live in the ledger, one row per run. ExecutedBy and the
  // LastPassed columns stay for manual cases, which really are run one at a time.
  const ran = new Set(cases.filter((c) => c.passed).map(keyOf));
  const stamped = rows.map((r) =>
    r.Source === "auto" && ran.has(keyOf(r))
      ? { ...r, Status: "Pass", ActualResult: "As specified" }
      : r);

  const run = {
    RunDate: date, Commit: commit.slice(0, 7), PR: pr, Branch: branch,
    TotalCases: cases.length,
    Passed: cases.filter((c) => c.passed).length,
    Failed: cases.filter((c) => !c.passed).length,
    DurationSeconds: (durationMs / 1000).toFixed(1),
    DomainBreakdown: groups.map((g) => `${g.name}:${g.passed}/${g.total}`).join(" "),
    ExecutedBy: runBy,
  };
  return { stamped, runs: [...readTable(RUNS, RUN_COLUMNS), run] };
}

/* ---------------------------------------------------------------- main */

const mode = process.argv[2] ?? "";
if (mode && !["--check", "--update", "--record"].includes(mode)) {
  console.error(`Unknown option ${mode}. Expected --check, --update or --record.`);
  process.exit(2);
}

const domains = loadDomains();
const tickets = existsSync(TICKETS) ? JSON.parse(readFileSync(TICKETS, "utf8")).issues : {};
if (domains.length === 0) console.error(`Warning: no domain map at ${path.relative(ROOT, DOMAINS)} — every case will be Unmapped.\n`);

const { cases, durationMs } = runVitest();
const existing = readTable(REGISTRY, COLUMNS);
const rebuilt = buildRegistry(existing, cases, domains, tickets);

// The report reads the on-disk registry so that --check reports what is committed.
const reportRows = mode === "--update" || existing.length === 0 ? rebuilt : existing;
const groups = summarise(cases, reportRows, domains);
printReport(groups, cases, reportRows);

const failed = cases.filter((c) => !c.passed);
for (const f of failed) {
  for (const m of f.failureMessages) console.error(`\n${f.file} › ${f.testCase}\n${m}`);
}

mkdirSync(TESTS_DIR, { recursive: true });

if (mode === "--update") {
  writeFileSync(REGISTRY, writeTable(rebuilt, COLUMNS));
  console.log(`Wrote ${rebuilt.length} rows to ${path.relative(ROOT, REGISTRY)}`);
}

if (mode === "--check") {
  const want = writeTable(rebuilt, COLUMNS);
  const have = existsSync(REGISTRY) ? readFileSync(REGISTRY, "utf8") : "";
  if (want !== have) {
    console.error(`\n✖ ${path.relative(ROOT, REGISTRY)} does not match the test suite.`);
    console.error(`  Run \`pnpm test:report --update\` and commit the result.\n`);
    process.exit(1);
  }
  console.log(`✔ ${path.relative(ROOT, REGISTRY)} is up to date.\n`);
}

if (mode === "--record") {
  if (failed.length > 0) {
    console.error("✖ Refusing to record a run with failing tests.");
    process.exit(1);
  }
  const { stamped, runs } = recordRun(rebuilt, groups, cases, durationMs);
  writeFileSync(REGISTRY, writeTable(stamped, COLUMNS));
  writeFileSync(RUNS, writeTable(runs, RUN_COLUMNS));
  console.log(`Recorded run ${runs[runs.length - 1].Commit} in ${path.relative(ROOT, RUNS)}\n`);
}

process.exit(failed.length > 0 ? 1 : 0);
