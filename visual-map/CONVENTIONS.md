# Authoring Conventions

House style for the Structurizr DSL workspaces in this repo. Derived from `01-main/workspace.dsl` —
that file is the reference; when in doubt, match it. For language syntax see [`SYNTAX.md`](SYNTAX.md);
for domain terms see [`GLOSSARY.md`](GLOSSARY.md).

> Examples below use placeholder names (`app`, `app_db`, generic table/module names). Replace them
> with your system's real artifact names — the point of the examples is the *shape*, not the content.

---

## C4 leveling

- **L1** — people (actors) and software systems. The system under focus is the single **in-focus**
  `softwareSystem`; everything else (other internal systems, third-party services, government/partner
  systems…) is an external system.
- **L2** — `container`s inside the in-focus system (databases, web UIs, batch pipelines, message
  daemons, APIs…).
- **L3** — `component`s inside a container (DB tables, UI forms/pages, stored procedures, request
  handlers…).

Do not model L4 (code). Stop at component level.

## Identifiers

- `!identifiers hierarchical` is set at the top of `model`.
- Identifiers are **snake_case**: `app_officer`, `nightly_batch`, `tb_person`.
- Reference nested elements by **full path**: `app_db.tb_person`, `app_web_ui.create_form`.

```
db = container "Application Database" "..." "Postgres" {
    tb_person = component "TB_PERSON" "Person master ..."
}
...
app_listener.mq_daemon -> app_db.tb_person "Person upsert from inbound event"
```

## Module grouping

Organise the in-focus system into module `group`s, and make **every container/component belong to one**.
Pick a small, stable set of groups that mirror the system's real modules/journeys, plus a shared group
for elements touched by every module. For example:

| Group | Meaning |
| --- | --- |
| `Shared Platform` | Touched by every module (e.g. the database, the web UI). |
| `<Module A>` | One business journey / subsystem. |
| `<Module B>` | Another business journey / subsystem. |

Inside a shared container (e.g. the database or web UI), sub-group components **by the owning module**
(`group "<Module A>"`, `group "<Module B>"`), plus cross-cutting groups such as:
- `group "Identity & Core"` — master/reference tables shared by all modules.
- `group "Cross-Journey State"` — tables written/read by 2+ modules.
- `group "Shared API"` — a function/procedure API surface used across modules.

## Naming

Keep real-world artifact names verbatim so the map traces back to source. The prefixes below are one
illustrative convention (a relational-DB + stored-procedure stack); adapt them to your stack and record
the chosen legend in [`GLOSSARY.md`](GLOSSARY.md):

| Artifact | Convention | Example |
| --- | --- | --- |
| DB table | `TB_*` (component name) | `TB_BOOKING` |
| Function | `FN_*` | `FN_CHECK_ELIGIBILITY` |
| Procedure / package | `PR_*` / `PKG_*` | `PR_GenerateLetter`, `PKG_PRINT.pr_extract` |
| Scheduled job | real filename **+ cron time** | `extract.sh (03:00)` |
| UI / handler | real filename / class.method | `PersonDetails.jsp`, `BookingCommand.reinstate` |

Identifier (snake_case) and display name can differ — the display name carries the real artifact
name, the identifier is a short handle: `tb_person = component "TB_PERSON" "..."`.

## Description length budget

A component/container/relationship `description` string is its **label on the diagram**, not a
place for prose. The budget is fixed:

- **One line, ≤ ~120 characters.** That is roughly what fits on one row of a rendered box at the
  default width. If it wraps to a third line on the diagram, it's too long.
- **Shape of that one line:** *purpose* → *rough scale* → *key classes*. Example:
  `"Admin maintenance of lookup tables. 4 pages / 7 actions. CodeAction + CodeMgmtCommand + CodeMgmtDAO."`
- **Relationship descriptions** get the same budget: *what flows* + *cadence/trigger*, with the
  mechanism in the technology slot (see [Relationship descriptions](#relationship-descriptions)).
- The moment you reach for a second sentence, a table, a list, or a provenance paragraph — **stop
  and move it to a `!docs` page.** The inline string then shrinks back to the one-line summary.

This budget is a hard rule, not a guideline: the diagram is unreadable if boxes carry paragraphs.

**Content by level** — the budget is the same one line; the higher the C4 level, the more semantic
and the less precise the label. Precision isn't deleted when you move up a level; it lives lower down.

- **L1** (people, software systems): business role + read/write direction + the *headline* mechanism
  word (`MQ`, `SFTP`, `LDAP`). No queue names, IDs, byte layouts, file paths, hostnames, or QoS —
  but **do keep business cadence + time-of-day** (how often / when a flow runs reads as plain
  English and matters at any level). It shouldn't matter at L1 that an external consumer speaks
  *binary* — only that it's a read-only consumer of the in-focus system's state.
- **L2** (containers): purpose + technology + rough scope/role. No full table/queue enumerations or
  filesystem paths.
- **L3** (components): the precision tier — may name key classes / tables / the one defining queue or
  ID, still one line ≤ ~120 chars.
- **Relationships**: *what flows* + *cadence/trigger*, mechanism in the technology slot; at most one
  identifying token (e.g. a single queue name) and only when it is the clearest label.

**No detail lost on trim.** Before deleting a token from a box or arrow, confirm it still lives at a
lower level or in a `#` comment. If the box/arrow is its *only* home, relocate it down — don't delete.

## Attached docs (`!docs`) — page shape

When detail exceeds the one-line budget, attach a Markdown file with `!docs`:

```
code_mgmt_ui = component "Code Administration UI" "Admin maintenance of lookup tables. 4 pages / 7 actions. CodeAction + CodeMgmtCommand + CodeMgmtDAO." {
    !docs ../docs/code-admin-ui.md
}
```

- One file per component/cluster, at `<folder>/docs/<kebab-name>.md`, kebab-named to match the
  cluster (`code-admin-ui.md`, `person-master-ui.md`).
- **Canonical page shape** (per-component UI docs — match it consistently across the repo):

  ```markdown
  # <Cluster display name>          ← matches the component's display name

  <one-paragraph intro>            ← purpose · what distinguishes it from sibling clusters ·
                                      who drives it · the config/wiring file. Cross-link
                                      siblings with [[wikilinks]].

  ## Pages / forms                 ← table: | Page | Purpose |
  ## Action mappings (N)           ← put the count N in the heading; table: | Action | Handler | Notes |
  ## Classes                       ← Action / Command / DAO bullets, list DAO methods
  ## DB write behaviour            ← which tables, UPSERT vs insert, special keys/sanitisation
  ## Provenance notes              ← every [?] / NOT FOUND claim, with its reasoning
  ```

  Keep this **section order**; omit a section only when it genuinely doesn't apply. The intro is
  prose; everything under a `##` is tabular/bulleted, not paragraphs.
- **Overview / pass docs** (e.g. a `database-triggers-overview.md`) are the exception: they drop the
  per-component sections and instead carry `## Modelling decisions`, `## Open items` (linking
  `[[verification#…]]`), and `## Files touched`. Use this shape for a cross-cutting source-read
  pass, not for a single UI cluster.
- Pick a small set of well-modelled components as the **reference examples** and match their split
  when adding new docs.

## Cross-references (Obsidian wikilinks)

If docs are round-tripped through an Obsidian vault (i.e. the maps are ingested from it), links use
Obsidian `[[Note]]` / `[[Note#Heading]]` syntax, **not** relative Markdown paths — keep the wikilink
form so the round-trip stays clean.

- In-repo targets resolve to sibling docs: `[[suspension-ui]]`, `[[person-master-ui]]`, `[[GLOSSARY]]`.
- External-vault targets are notes that live only in Obsidian — e.g. a verification log
  (`[[verification#V19]]`), an entry-point catalog, or a journey-flow note. These won't open from the
  repo; that's expected. Don't delete or rewrite them into paths.

> If this repo is *not* round-tripped through Obsidian, use ordinary relative Markdown links instead
> and drop this section.

## Tags & styles

Tags drive the `styles` block. Use the existing taxonomy; don't invent new tags without adding a matching style.

**Colour scheme:** soft/pastel — light fills + saturated coloured strokes + tinted dark text (no solid fills).

| Element | Tag | Colour | Shape |
| --- | --- | --- | --- |
| Person | `Person` | soft yellow (fill `#fff2cc`, stroke `#d6b656`) | person |
| In-focus system | `Software System` | soft blue (fill `#dae8fc`, stroke `#6c8ebf`) | rounded box |
| Container (default) | `Container` | soft blue (fill `#dae8fc`, stroke `#6c8ebf`) | rounded box |
| Database | `Database` | soft blue (container fill) | cylinder |
| Filesystem | `Filesystem` | soft blue (container fill) | folder |
| Component | `Component` | light blue (fill `#eef5fd`, stroke `#6c8ebf`) | component |
| External system | `External` | soft teal (mint fill `#e8f8f5`, turquoise stroke `#1abc9c`) | rounded box |
| Unknown / unconfirmed external | `External Unknown` | soft red + dashed border (fill `#fdecea`, stroke `#e74c3c`) — flags a gap | rounded box |

**Module colours** are applied to the **group boundary/label**, with containers staying soft
blue *inside* the coloured boundary. Assign one colour per module group, e.g.:

| Module group | Colour |
| --- | --- |
| `Group:<Module A>` | red |
| `Group:<Module B>` | green |
| `Group:<Module C>` | yellow |
| `Group:Shared Platform` | grey |

> If a colour is reused across two different element *types* (e.g. yellow for both a `Person` shape
> and a `Group` outline), that's fine — different shapes keep them visually distinct.

Shapes come from the palette in [`SYNTAX.md`](SYNTAX.md) (`Cylinder`, `Folder`, `Bucket`, `Pipe`,
`Robot`, `WebBrowser`, …). Default C4 tags (`Element`, `Person`, `Software System`, `Container`,
`Component`, `Relationship`) are styled in the same block — see `01-main/workspace.dsl` `styles { ... }`.

## Marker discipline (provenance — preserve these, never silently drop)

The map mixes confirmed-from-code facts with inferences. The markers encode trust level, and the
discipline around them is what makes the map trustworthy.

**The markers:**

- `[?]` in a name or description — **inferred / unconfirmed** element or relationship. Example: `manual_result_ui = component "Manual Result Entry UI [?]" "..."`.
- `"NOT FOUND in code"` / `"???"` in a description — a **known gap**; the integration is believed to exist but isn't evidenced in source. Tag the element `External Unknown` where applicable.

**Where each marker lives:**

- `[?]` attaches to the *smallest* uncertain unit — put it in the **name** when the whole element
  is speculative, in the **description** when only one claim is shaky (e.g. one action's write path).
- When detail moves to a `!docs` page, every marker moves with it into that page's
  `## Provenance notes` section, each with its reasoning — never lost in the migration.
- A `NOT FOUND` / `???` element should also carry the `External Unknown` tag so the gap is visible
  on the diagram, not just in text.

**Removing a marker is a verification claim.** Dropping a `[?]` asserts you checked the fact against
source. So only remove one when you've actually confirmed it, and **record the confirmation** rather
than just deleting the marker:

- Log the finding in the verification note and cite it from the doc — `see [[verification#V19]]`.
- If source-read *contradicts* a prior claim (not just confirms it), say so explicitly in the doc
  (a "Catalog claim vs Source reality" table is a good model) and open a `[[verification#…]]` item.
  Don't quietly flip the text.

When in doubt, leave the marker in. An over-cautious `[?]` costs a re-check; a wrongly-removed one
silently launders a guess into a fact.

## Relationship descriptions

Relationships carry the real **mechanism** (in the technology slot) and the **flow + cadence/trigger**
(in the description). Write the description for an **intelligent but non-expert reader** — someone who
wants to know *what flows and how often*, not the wire format.

**Shape: verb + noun, then frequency/time.** Lead with an action verb and the business noun; append
cadence and time-of-day when they exist.

```
courts -> app_listener.mq_daemon "Sends conviction + order PDF. Event-driven." "IBM MQ"
app_batch.sftp_print_out -> print_vendor "07:35: sends letters for printing." "SFTP"
app_batch.elig_job -> app_db.fn_check_eligibility "Calls for today + tomorrow."
```

Prefer `"SFTP"`, `"IBM MQ"`, `"PL/SQL call"`, `"HTTP POST"`, `"File"`, `"Physical"` as the technology slot.

**Keep:** the verb + business noun, frequency/cadence (`daily`, `7x/day`, `weekly Sat`), time-of-day
(`04:50`, `07:35`), and concrete user-meaningful facts (fees, `up to 3 attempts`, SLAs, `sequentially
dependent`).

**Drop the jargon noise:** filenames, hosts/IPs, queue names, MQ QoS (persistent / priority / expiry),
wire-format and protocol words (`RFH2`, `SSL/TCP`, `Base64`), internal class / DAO /
command names, and journey `Step-N` references. **Don't repeat the technology slot** either — it already
renders the mechanism on the arrow (`[SFTP]`, `[IBM MQ]`, `[LDAP]`), so `"SFTP push ..." "SFTP"` is redundant.

**Don't lose provenance on a trim.** Before deleting a token, confirm it survives elsewhere:
- Class / DAO / command names are usually already in the section's `#` block comment — they can simply be dropped from the arrow.
- A real artefact the arrow is the *only* home for (an SFTP host like `appuser@10.x.x.x`, a data filename
  like `Delivered*.txt.p7`, a cron script like `extract.sh`, the one MQ QoS line) → **relocate it into a
  `#` comment** above the edge or section; don't delete it.
- Provenance markers (`[?]`, `NOT FOUND`, `not in code`) stay verbatim (see [Marker discipline](#marker-discipline-provenance--preserve-these-never-silently-drop)).

**This phrasing applies at every level — the level controls how much detail survives, not the style**
(see [Content by level](#description-length-budget)). L1 / externally-facing edges are the leanest; L2
container edges add purpose + scope; **L3 component edges are the precision tier and may name the key
table / class / one defining queue or ID** — still one line, but a little more detail is acceptable when
it earns its place. The moment a relationship needs a second sentence or a list, move the detail to a
`!docs` page and shrink the arrow back to its one-line summary.

## Views

- Give **every view an explicit `[key]`** — auto-generated keys are not layout-stable.
- Use `autoLayout lr` (matches existing diagrams).
- Standard set per workspace: one `systemContext`, one `container`, and one `component` view per container worth drilling into.
- `dynamic` views are the tool for **user-journey workspaces**: list relationships in order rather than `include *`.
- **Dynamic-view step descriptions follow the same [verb+noun rule](#relationship-descriptions)** as static-view edges. The step is still a relationship; the `Step N: …` / `[Δ]` / `[path]` scaffolding is journey narrative, but the body is *verb + business noun + cadence/threshold* — drop tables, procs, classes, letter codes, tag codes, column flags, SQL fragments. Relocate any orphan artefact into a `#` comment above the view or the step (per [Relationship descriptions](#relationship-descriptions)).

## Tool-managed files

- `workspace.dsl` is the **source of truth** — edit this.
- `workspace.json` is **generated by Structurizr Lite** and stores manual layout — do not hand-edit.
- `.structurizr/` is gitignored runtime/index data.

## Modularization principles (for a future split)

If the model grows into a monolith `workspace.dsl`, structure it so a later split is mechanical:

- **model / views / styles are separable** — they can become `model.dsl`, `views.dsl`, `styles.dsl` pulled in via `!include`.
- **Per-module blocks are comment-fenced** with `# =====` banners (e.g. `# MODULE A`, `# MODULE A RELATIONSHIPS`). These fences are the natural `!include` seams — each module's elements + relationships can move to its own fragment.
- Keep a single top-level `workspace.dsl` that `!include`s the fragments, so identifiers stay in one hierarchical namespace.
- `!include` makes a workspace non-portable (see `SYNTAX.md`); that's acceptable for a local-Lite repo.
