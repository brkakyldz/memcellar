---
name: reports-architecture
description: Scaffolds the reports/ research store into a project repo — one place where research output lands as dated Markdown so a later session reads it back instead of searching again. Use when the owner says "set up reports", "scaffold the research store", "add the reports folder", or the same in their language, or before the first `research` run in a project that has no reports/ folder yet. Not for a memcellar vault, which has its own reports/ folder with its own rules.
---

# Scaffold the reports/ research store

`reports/` in a project is **a research store and nothing else**: where the
`research` skill's reports land so a future session can read them back.

It is not a working record. Where the project stands lives in
`docs/CURRENT_STATE.md`, why in `docs/decisions/`, what happened in
`git log`, lessons in `docs/lessons/` (ADR 0050). A second record beside
those is never read and goes stale.

**Never run it in a memcellar vault** (a folder with
`core/IDENTITY.md` and `.agents/write-gate.md`). The vault already has a
flat `reports/` with its own contract (`reports/README.md`), and the
`research` skill writes there through the write gate.

## Usage

```bash
node <skill-dir>/scripts/scaffold.mjs [project-root]
```

`<skill-dir>` is the folder this SKILL.md was loaded from. The root defaults
to the current directory. The script is idempotent: it never overwrites an
existing file and refuses to run in a vault.

## What it creates

```
reports/
├── .reports-architecture   # marker — how `research` recognizes the store
├── README.md               # what goes here and what doesn't
└── research/
    └── README.md           # naming: YYYY-MM-DD_<slug>.md
```

That is the whole architecture. Then offer the snippet at the end of
`reports/README.md` for the project's `AGENTS.md`, and commit the new paths
by name if the owner wants them committed.

## What goes in, what stays out

| Goes in `reports/research/` | Lives elsewhere |
|---|---|
| Web-research reports from `research` | Where the project stands → `docs/CURRENT_STATE.md` |
| Comparisons of libraries, tools, approaches | Decisions expensive to reverse → `docs/decisions/` |
| Prior-art and context gathering before a build | Corrections to how the agent works → `docs/lessons/` (`lesson`) |

One file per research run, sources linked inline. Reports are
**immutable**: a report is what was believed on that date; a correction is a
newer report that references the old one.

## When not to use it

A repo that will never hold research doesn't need the folder; `research`
falls back to one `research-<slug>.md` at the root. A repo that already
keeps research somewhere (`docs/research/`) keeps it there — don't migrate
it to fit this layout.
