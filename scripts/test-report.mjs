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
 *   pnpm test:report --check-pr-body   validate a PR's "Manual test results" table
 *                               (PR_BODY, PR_TITLE, PR_BRANCH in the environment)
 *   pnpm test:report --record-manual   append that table to manual-runs.csv
 *                               (CI, main; PR_BODY, PR_NUMBER, PR_AUTHOR, GITHUB_SHA)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = path.join(ROOT, "docs", "tests");
const REGISTRY = path.join(TESTS_DIR, "test-registry.csv");
const RUNS = path.join(TESTS_DIR, "test-runs.csv");
const MANUAL = path.join(TESTS_DIR, "manual-registry.csv");
const MANUAL_RUNS = path.join(TESTS_DIR, "manual-runs.csv");
const DOMAINS = path.join(TESTS_DIR, "domains.json");
const TICKETS = path.join(TESTS_DIR, "tickets.json");

// Ordered to mirror the IS212 test case template: the specification fields
// first (written once), then the execution record (one per run).
const COLUMNS = [
  "TestID", "Domain", "Quadrant", "Ticket", "TicketTitle", "UserStory", "AC",
  "File", "Suite", "TestCase",
  "Preconditions", "TestSteps", "TestData", "ExpectedResult",
  "CreatedBy", "DateCreated",
  "ActualResult", "Status", "Remarks",
];

// Manual cases are a separate file with their own lifecycle: the specification
// is written once by hand, and every execution is a row in the manual ledger.
// Keeping them out of the automated registry means CI never has to guess which
// rows it may stamp, and a manual result never rides in the same diff as a
// regenerated test row.
const MANUAL_COLUMNS = [
  "CaseID", "Domain", "Ticket", "TicketTitle", "UserStory", "AC", "Scenario",
  "Preconditions", "TestSteps", "TestData", "ExpectedResult", "StepsDoc",
  "CreatedBy", "DateCreated", "Status",
];
const MANUAL_RUN_COLUMNS = [
  "RunDate", "CaseID", "Result", "ActualResult", "Remarks", "ExecutedBy",
  "PR", "Commit", "Environment", "Evidence",
];
const MANUAL_STATUSES = ["Active", "Retired"];
const MANUAL_RESULTS = ["Pass", "Fail", "Blocked", "Not Executed"];

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
 * up in the PR diff.
 */
function buildRegistry(existing, cases, domains, tickets) {
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));

  const seen = new Set();
  const rows = [];

  for (const c of cases) {
    const key = keyOf(c);
    seen.add(key);
    const prior = byKey.get(key);
    // Authorship is settled once, like the id: re-blaming a moved line would
    // credit whoever last touched the file rather than whoever wrote the test.
    // "Not Committed Yet" is git blame's own placeholder for an unresolved
    // line, not a real answer -- it must not count as settled, or a row
    // stays stuck on it forever, even once the line is actually committed.
    const settled = Boolean(prior?.CreatedBy) && prior.CreatedBy !== "Not Committed Yet";
    const authored = settled ? prior : (blameFor(c.file).get(c.line) ?? {});
    rows.push({
      TestID: prior?.TestID ?? "",
      Domain: domainFor(c.file, domains),
      Quadrant: prior?.Quadrant || "Q1",
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
      CreatedBy: (settled && prior.CreatedBy) || authored.author || authored.CreatedBy || "",
      DateCreated: (settled && prior.DateCreated) || authored.date || authored.DateCreated || "",
      ActualResult: prior?.ActualResult ?? "",
      Status: prior?.Status || "Not Executed",
      Remarks: prior?.Remarks ?? "",
    });
  }

  for (const [key, row] of byKey) {
    if (!seen.has(key)) rows.push({ ...row, Status: "Retired" });
  }

  const order = new Map(domains.map((d, i) => [d.domain, i]));
  const rank = (r) => (order.has(r.Domain) ? order.get(r.Domain) : domains.length);
  const sorted = rows.sort((a, b) =>
    rank(a) - rank(b) ||
    (a.Domain).localeCompare(b.Domain) ||
    a.File.localeCompare(b.File) ||
    a.Suite.localeCompare(b.Suite) ||
    a.TestCase.localeCompare(b.TestCase));

  // A row that already has an ID keeps it, retired or not. A new row's ID is a
  // hash of its identity, not "the next number": two branches cut from the same
  // main each add different tests and so mint different IDs, instead of both
  // claiming the same next counter value and colliding on rebase.
  const taken = new Set(sorted.map((r) => r.TestID).filter(Boolean));
  for (const row of sorted) {
    if (row.TestID) continue;
    row.TestID = hashId(keyOf(row), taken);
    taken.add(row.TestID);
  }

  return sorted;
}

/**
 * UT-<6 hex of sha1(key)>. Six hex is 16.7M values against a few hundred cases,
 * so a clash is vanishingly rare; if one happens anyway, widen to eight rather
 * than ever handing out an ID that is already taken.
 */
function hashId(key, taken) {
  const hex = createHash("sha1").update(key).digest("hex");
  const short = `UT-${hex.slice(0, 6)}`;
  return taken.has(short) ? `UT-${hex.slice(0, 8)}` : short;
}

/** IDs that appear on more than one row -- a merge or rebase can do this silently. */
const duplicateIds = (rows) => {
  const seen = new Set();
  const dupes = new Set();
  for (const r of rows) {
    if (!r.TestID) continue;
    (seen.has(r.TestID) ? dupes : seen).add(r.TestID);
  }
  return [...dupes];
};

/**
 * The manual specification, with the title and parent user story refilled from
 * the ticket map so they cannot drift from the ticket. Everything else is hand
 * written and is never rewritten.
 *
 * Rows are kept in CaseID order rather than the order they were added. Two
 * branches each appending their cases to the end of the file touch the same
 * last line and conflict on every rebase; sorted, each feature's TC-<AREA>
 * block lands in its own place in the file and they merge cleanly.
 */
function buildManual(existing, tickets) {
  return existing
    .map((r) => {
      const issue = tickets[r.Ticket];
      return issue ? { ...r, TicketTitle: issue.title, UserStory: issue.parent ?? r.Ticket } : r;
    })
    .sort((a, b) => a.CaseID.localeCompare(b.CaseID, "en", { numeric: true }));
}

/**
 * tickets.json as --update writes it: issues in ticket-number order, so two
 * branches adding their tickets do not both append after the same last entry.
 * Writing it back also drops a duplicated key, which JSON.parse would otherwise
 * resolve silently to whichever copy comes last.
 */
function ticketsText(file) {
  const num = (key) => Number(key.replace(/\D/g, ""));
  const issues = Object.fromEntries(Object.entries(file.issues).sort(([a], [b]) => num(a) - num(b)));
  return JSON.stringify({ ...file, issues }, null, 2) + "\n";
}

/** Latest result per case: the ledger is append-only, so the last row wins. */
function latestManualResults(runs) {
  return new Map(runs.map((r) => [r.CaseID, r]));
}

/** Things a hand edit can get wrong in the manual spec or its ledger. */
function manualProblems(manual, runs) {
  const problems = [];
  const ids = new Set();
  for (const m of manual) {
    if (!m.CaseID) problems.push("a manual case has no CaseID");
    else if (ids.has(m.CaseID)) problems.push(`duplicate manual CaseID ${m.CaseID}`);
    ids.add(m.CaseID);
    if (!MANUAL_STATUSES.includes(m.Status)) {
      problems.push(`${m.CaseID}: Status "${m.Status}" is not one of ${MANUAL_STATUSES.join(", ")}`);
    }
    if (m.StepsDoc && !existsSync(path.join(ROOT, m.StepsDoc))) {
      problems.push(`${m.CaseID}: StepsDoc ${m.StepsDoc} does not exist`);
    }
  }
  for (const r of runs) {
    if (!ids.has(r.CaseID)) problems.push(`manual-runs: ${r.CaseID || "(blank)"} is not a known manual case`);
    if (!MANUAL_RESULTS.includes(r.Result)) {
      problems.push(`manual-runs: ${r.CaseID} Result "${r.Result}" is not one of ${MANUAL_RESULTS.join(", ")}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.RunDate)) {
      problems.push(`manual-runs: ${r.CaseID} RunDate "${r.RunDate}" is not YYYY-MM-DD`);
    }
  }
  return problems;
}

/**
 * The manual results a PR reports, from a markdown table under a
 * "## Manual test results" heading in its description:
 *
 *   | CaseID | Result | Actual result | Remarks | Evidence |
 *
 * The PR description is where the author records what they ran, because the PR
 * is also where a reviewer reads it. Rows with no CaseID (the template's blank
 * row, a dash) are placeholders and ignored.
 */
function parsePrManualResults(body) {
  const lines = (body ?? "").replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,6}\s*manual test results\s*$/i.test(l.trim()));
  if (start === -1) return [];
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;
    // Split on pipes that are not escaped, so a remark can still say "a \| b".
    const cells = line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
    if (/^-+:?$|^:-+:?$/.test(cells[0]) || /^caseid$/i.test(cells[0])) continue;
    if (!cells[0] || /^[-—–]+$/.test(cells[0])) continue;
    const [CaseID, Result = "", ActualResult = "", Remarks = "", Evidence = ""] = cells;
    rows.push({ CaseID, Result, ActualResult, Remarks, Evidence });
  }
  return rows;
}

/**
 * Whether the reported results may be merged and recorded. A Fail or Blocked is
 * a finding to fix before merge, not a result to file away, so it stops the PR
 * rather than landing in the ledger as if the feature had been signed off.
 */
function prProblems(results, manual) {
  const known = new Map(manual.map((m) => [m.CaseID, m]));
  const problems = [];
  for (const r of results) {
    if (!known.has(r.CaseID)) problems.push(`${r.CaseID} is not a case in manual-registry.csv`);
    else if (known.get(r.CaseID).Status !== "Active") problems.push(`${r.CaseID} is retired`);
    if (!MANUAL_RESULTS.includes(r.Result)) {
      problems.push(`${r.CaseID}: Result "${r.Result}" must be one of ${MANUAL_RESULTS.join(", ")}`);
    } else if (r.Result === "Fail" || r.Result === "Blocked") {
      problems.push(`${r.CaseID} is ${r.Result}: fix it, or re-run it, before merging`);
    }
  }
  return problems;
}

/**
 * Active cases for the tickets a PR is about that its table does not mention.
 * The PR's tickets come from its title, its branch name and its
 * "Closes/Fixes/Refs SPM-n" lines; the title only has one as a trailing tag.
 */
function unreportedCases(results, manual, title, body, branch) {
  const linked = (body ?? "").match(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?)\s+SPM-\d+/gi) ?? [];
  const tickets = new Set(`${title ?? ""} ${branch ?? ""} ${linked.join(" ")}`.match(/SPM-\d+/gi)?.map((t) => t.toUpperCase()));
  const reported = new Set(results.map((r) => r.CaseID));
  return manual.filter((m) => m.Status === "Active" && tickets.has(m.Ticket) && !reported.has(m.CaseID));
}

/* ---------------------------------------------------------------- the report */

function summarise(cases, rows, domains, manual, latest) {
  const idByKey = new Map(rows.map((r) => [keyOf(r), r.TestID]));
  const names = [...domains.map((d) => d.domain), "Unmapped"];
  const groups = new Map(names.map((n) => [n, { name: n, total: 0, passed: 0, failures: [], manual: 0, manualPassed: 0 }]));

  for (const c of cases) {
    const name = domainFor(c.file, domains);
    if (!groups.has(name)) groups.set(name, { name, total: 0, passed: 0, failures: [], manual: 0, manualPassed: 0 });
    const g = groups.get(name);
    g.total += 1;
    if (c.passed) g.passed += 1;
    else g.failures.push({ ...c, testId: idByKey.get(keyOf(c)) ?? "—" });
  }
  for (const m of manual) {
    if (m.Status !== "Active" || !groups.has(m.Domain)) continue;
    const g = groups.get(m.Domain);
    g.manual += 1;
    if (latest.get(m.CaseID)?.Result === "Pass") g.manualPassed += 1;
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
    const manual = g.manual > 0 ? `  · ${g.manualPassed}/${g.manual} manual passed` : "";
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
      ...groups.map((g) => `| ${g.failures.length === 0 ? "✅" : "❌"} | ${g.name} | ${g.passed}/${g.total} | ${g.manual ? `${g.manualPassed}/${g.manual}` : "—"} |`),
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
  // A squash merge leaves no "Merge pull request" line, so CI passes the number
  // it looked up from the commit.
  const pr = process.env.PR_NUMBER
    || /Merge pull request #(\d+)/.exec(git("log", "-1", "--pretty=%B"))?.[1] || "";
  const date = new Date().toISOString().slice(0, 10);

  const runBy = process.env.GITHUB_RUN_ID
    ? `CI run ${process.env.GITHUB_RUN_ID}`
    : `${git("config", "user.name") || "local"} (local)`;

  // Only the per-case outcome is stamped here. Who ran it, at which commit and
  // when describe the *run*, and the whole suite runs at once -- copying them
  // onto every row would write one fact 368 times and rewrite the file on every
  // merge. They live in the ledger, one row per run.
  const ran = new Set(cases.filter((c) => c.passed).map(keyOf));
  const stamped = rows.map((r) =>
    ran.has(keyOf(r))
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
if (mode && !["--check", "--update", "--record", "--check-pr-body", "--record-manual"].includes(mode)) {
  console.error(`Unknown option ${mode}. Expected --check, --update, --record, --check-pr-body or --record-manual.`);
  process.exit(2);
}

const manualExisting = readTable(MANUAL, MANUAL_COLUMNS);
const manualRuns = readTable(MANUAL_RUNS, MANUAL_RUN_COLUMNS);

// Reads only the PR text and the manual registry, so it runs without the suite.
if (mode === "--check-pr-body") {
  const results = parsePrManualResults(process.env.PR_BODY);
  const problems = prProblems(results, manualExisting);
  for (const m of unreportedCases(results, manualExisting, process.env.PR_TITLE, process.env.PR_BODY, process.env.PR_BRANCH)) {
    console.log(`::warning::${m.CaseID} (${m.Ticket}) has manual steps but no row in "Manual test results": ${m.Scenario}`);
  }
  if (problems.length > 0) {
    console.error(`\n✖ "Manual test results" in the PR description has problems:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error("");
    process.exit(1);
  }
  console.log(`✔ ${results.length} manual result(s) reported.`);
  process.exit(0);
}

// Runs once a PR has merged. It repeats the PR check first, so a Fail that
// somehow got through is refused here too rather than filed as a pass.
if (mode === "--record-manual") {
  const results = parsePrManualResults(process.env.PR_BODY);
  const problems = prProblems(results, manualExisting);
  if (problems.length > 0) {
    for (const p of problems) console.error(`✖ ${p}`);
    process.exit(1);
  }
  const pr = process.env.PR_NUMBER ?? "";
  // A re-run of the job must not record the same PR twice.
  const done = new Set(manualRuns.filter((r) => r.PR === pr && pr).map((r) => r.CaseID));
  const date = new Date().toISOString().slice(0, 10);
  const added = results
    .filter((r) => r.Result !== "Not Executed" && !done.has(r.CaseID))
    .map((r) => ({
      RunDate: date, ...r, ExecutedBy: process.env.PR_AUTHOR ?? "", PR: pr,
      Commit: (process.env.GITHUB_SHA ?? "").slice(0, 7), Environment: "",
    }));
  if (added.length > 0) writeFileSync(MANUAL_RUNS, writeTable([...manualRuns, ...added], MANUAL_RUN_COLUMNS));
  console.log(`Recorded ${added.length} manual result(s) for PR #${pr || "?"}.`);
  process.exit(0);
}

const domains = loadDomains();
const ticketsFile = existsSync(TICKETS) ? JSON.parse(readFileSync(TICKETS, "utf8")) : null;
const tickets = ticketsFile?.issues ?? {};
if (domains.length === 0) console.error(`Warning: no domain map at ${path.relative(ROOT, DOMAINS)} — every case will be Unmapped.\n`);

const { cases, durationMs } = runVitest();
const existing = readTable(REGISTRY, COLUMNS);
const rebuilt = buildRegistry(existing, cases, domains, tickets);
const manualRebuilt = buildManual(manualExisting, tickets);

// The report reads the on-disk registry so that --check reports what is committed.
const reportRows = mode === "--update" || existing.length === 0 ? rebuilt : existing;
const groups = summarise(cases, reportRows, domains, manualRebuilt, latestManualResults(manualRuns));
printReport(groups, cases, reportRows);

const failed = cases.filter((c) => !c.passed);
for (const f of failed) {
  for (const m of f.failureMessages) console.error(`\n${f.file} › ${f.testCase}\n${m}`);
}

mkdirSync(TESTS_DIR, { recursive: true });

if (mode === "--update") {
  writeFileSync(REGISTRY, writeTable(rebuilt, COLUMNS));
  console.log(`Wrote ${rebuilt.length} rows to ${path.relative(ROOT, REGISTRY)}`);
  writeFileSync(MANUAL, writeTable(manualRebuilt, MANUAL_COLUMNS));
  console.log(`Wrote ${manualRebuilt.length} rows to ${path.relative(ROOT, MANUAL)}`);
  if (ticketsFile) writeFileSync(TICKETS, ticketsText(ticketsFile));
}

if (mode === "--check") {
  // Checked on the committed file, not the rebuild: --update would paper over a
  // duplicate that a rebase introduced, and it must be seen and fixed instead.
  const dupes = duplicateIds(existing);
  if (dupes.length > 0) {
    console.error(`\n✖ ${path.relative(ROOT, REGISTRY)} has duplicate TestIDs: ${dupes.join(", ")}`);
    console.error(`  Blank the ID cell on the newer row, then run \`pnpm test:report --update\`.\n`);
    process.exit(1);
  }
  const problems = manualProblems(manualExisting, manualRuns);
  if (problems.length > 0) {
    console.error(`\n✖ The manual registry or ledger has problems:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error("");
    process.exit(1);
  }
  const stale = [
    [REGISTRY, writeTable(rebuilt, COLUMNS)],
    [MANUAL, writeTable(manualRebuilt, MANUAL_COLUMNS)],
    ...(ticketsFile ? [[TICKETS, ticketsText(ticketsFile)]] : []),
  ].filter(([file, want]) => (existsSync(file) ? readFileSync(file, "utf8") : "") !== want);
  if (stale.length > 0) {
    for (const [file] of stale) console.error(`\n✖ ${path.relative(ROOT, file)} does not match the test suite.`);
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
