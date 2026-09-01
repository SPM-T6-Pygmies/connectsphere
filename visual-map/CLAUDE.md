# CLAUDE.md

## What this repo is

The source of truth for **C4 visual maps** of a software system, authored in **Structurizr DSL**.
Each top-level numbered folder is **one Structurizr workspace = one context/lens** onto the system.
The maps trace back to real source artifacts (database tables, stored procedures, batch/cron jobs,
UI files, message handlers…), so **accuracy matters more than completeness**.

> This repo is a reusable scaffold. The conventions, syntax reference, and guardrails are
> project-agnostic; the domain specifics (system name, externals, glossary) get filled in per
> project. `01-main/workspace.dsl` is the reference model you build first and then match.

## Repo layout

| Path | What it is |
| --- | --- |
| `01-main/workspace.dsl` | The whole system (people, externals, all modules). The **reference model** — match its style. |
| `NN-<journey>/workspace.dsl` | A per-journey / per-lens workspace. Uses `workspace extends ../01-main/workspace.dsl` + **dynamic views** only — no new model elements (those go upstream in `01-main/`). |
| `SYNTAX.md` | Authoritative Structurizr DSL **language reference**. |
| `CONVENTIONS.md` | House style for authoring the DSL. |
| `GLOSSARY.md` | Domain vocabulary for the system being mapped. |
| `README.md` | How to run Structurizr Lite locally (Docker → localhost:8080). |
| `<folder>/docs/` (per workspace) | Markdown long-form notes attached to elements via `!docs`. Used when a component's detail is too long for its inline description (see `CONVENTIONS.md`). |
| `workspace.json` (per folder) | **Tool-generated** by Structurizr Lite; holds manual layout. Do not hand-edit. |
| `.structurizr/` | Gitignored runtime/index data. |

Each `workspace.dsl`'s top-line `workspace "..." "..."` description states that workspace's scope —
read it first to know which lens you're in.

## Authoring `.dsl` files

1. **Syntax** — consult [`SYNTAX.md`](SYNTAX.md) for all DSL constructs. Do not guess syntax and do not fetch external docs; `SYNTAX.md` is self-contained and authoritative for this repo.
2. **Style** — follow [`CONVENTIONS.md`](CONVENTIONS.md): C4 leveling, hierarchical snake_case identifiers, module grouping, tag/style taxonomy, relationship-description format.
3. **Domain** — resolve any unfamiliar term via [`GLOSSARY.md`](GLOSSARY.md) before modelling it.

## Running & validating

See [`README.md`](README.md). Structurizr Lite reads `workspace.dsl` and serves the rendered
diagrams at `http://localhost:8080`. A docs-only or model edit should render without errors; if
the DSL is invalid, Lite shows a parse error on load. The workspace this repo serves is controlled
by `structurizr.properties`.

## Guardrails

- **Accuracy over completeness** — don't invent code artifacts, tables, or integrations.
- **Preserve provenance markers** — `[?]` (inferred/unconfirmed) and `"NOT FOUND in code"` / `"???"` (known gap) encode trust level. Don't silently remove them; removing a `[?]` claims you verified the fact against source.
- **Keep views in sync** — when you add model elements, make sure they appear in (or are intentionally excluded from) the relevant view.
- **One workspace = one context** — don't blend lenses; add a new numbered folder instead.
- **Edit `workspace.dsl`, not `workspace.json`.**

## Adding a new workspace

1. Create a new numbered folder (e.g. `02-<journey-name>/`) with its own `workspace.dsl`.
2. Set the workspace description to state the lens precisely.
3. Choose diagram types: static C4 (`systemContext` / `container` / `component`) for structure, or `dynamic` views for user journeys.
4. Reuse the identifier, tag, and style conventions from `01-main` so the maps stay visually consistent.
