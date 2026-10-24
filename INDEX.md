---
type: topic
created: 2026-09-03
updated: 2026-10-24
tags: [index, catalog, navigation]
status: growing
related: ["[[lifecycle-policy]]"]
---

# Index — every page in the wiki, one line each

**Top line.** The catalog of the living layer in `notes/` (ADR 0055) and of every ingested source: what exists,
what each page is for, and how mature it is. Read this first when answering a
question, then drill into the two or three pages that matter — it is the cheap
half of retrieval, and it is why no search index has been needed.

This is a *content* catalog. Its chronological twin is `logs/` (what happened,
when), the durable-fact index is `core/MEMORY.md` (one line per fact, budgeted),
and the open-work surface is `PROPOSALS.md`. Four files, four jobs, no overlap.

**Who writes it:** whoever adds or retires a page — `/ingest`, `/file`,
`/lesson`, `/curator`, or a session writing a note by hand. All of them carry
the same responsibility: a note without a row here is a page nothing can find.

**What keeps it honest:** `node scripts/link-sweep.mjs`, which compares every
file in `notes/` against this table and takes no view of git at all. It is a
**warning, not a gate** — a missing row is reported, never blocked (ADR 0035,
0038). The `index-coverage` check in `.claude/hooks/checks.mjs` encodes the
same rule for the files you are about to commit; nothing runs it on its own
since v1.1, so run `node .claude/hooks/checks.mjs --staged` before a commit.

Keep the description column about *what the page is for*, not what it contains.
A row that reads "notes on X" tells a future session nothing it could not have
guessed from the filename, and the whole value of this file is deciding what to
open without opening it.

---

## Projects

| Page | What it is | Status |
|---|---|---|
| _(your first project card goes here — `.claude/templates/project.md`)_ | | |

## Topics — the world

| Page | What it is | Status |
|---|---|---|
| _(what you have read and distilled)_ | | |

## Topics — the vault itself

| Page | What it is | Status |
|---|---|---|
| [[source-roots]] | External immutable source roots, registered as pointers rather than copied | seedling |

## Playbooks

| Page | What it is | Status |
|---|---|---|
| [[lifecycle-policy]] | What happens to a note or a fact, with rationale; binding rules live in `AGENTS.md` | active |
| [[self-evolution-policy]] | How the vault changes itself — the maintenance loop, growth control, the noise budget | active |

## Lessons — one file per recurring behaviour

Each file collects the corrections about one behaviour, verbatim, in the
language they were given in: a lesson's value is the wording as it was said.
A second entry from a different task is where the agent proposes a rule —
a skill, `AGENTS.md`, `USER.md` or a check — and the owner approves or
refuses it (ADR 0048). A project's own lessons live in its repo, not here.

| Page | The behaviour | Routing |
|---|---|---|
| _(none yet — `/lesson` writes these)_ | | |

## Folders, not pages

Two folders hold pages that are not listed here row by row (ADR 0055): each is
listed on the topic page it feeds.

| Folder | What it holds |
|---|---|
| `reports/` | Dated readings of the world — research, comparisons, audits. Write-once; `reports/README.md` |
| `outputs/` | Deliverables made to be used and then done with — lists, drafts, inventories. They expire; `outputs/README.md` |

## Ingested sources

Each row is a document in `raw/`, read once and distilled into the notes named
beside it. A file in `raw/` with no row here has not been ingested — that, and
not the folder's size, is the graveyard signal.

| Source | Ingested | Report → topic page |
|---|---|---|
| _(none yet — `/ingest` writes these)_ | | |
