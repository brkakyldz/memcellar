---
name: adr
description: Records an architecture decision and checks it against the earlier ones for contradictions — an ADR in docs/decisions/ in a project repo, a `type: decision` note in notes/ in a Second Brain OS vault. Use when a choice that is expensive to reverse is made (library, data model, protocol, directory architecture, security boundary), or when the owner says "record this decision", "write down why we chose this", "write an ADR", or the same request in the owner's language.
---

# Record a decision

Keeping decisions like *"why event sourcing and not CRUD"* in writing is what
stops future agents and humans from contradicting the past without noticing.
The value is not the writing; it is that the next contradiction is visible
instead of silent.

## Where it goes

First tell which kind of folder the session is in:

- **A Second Brain OS vault** — the folder has `core/IDENTITY.md` and
  `.agents/write-gate.md`. Go to § In a vault.
- **A project repo** — anything else. Go to § In a project. A project session
  never reads or writes the vault (ADR 0052): a project's decisions live in
  the project.

Either way, write in the language of that home (the repo's docs language; in
the vault, the vault's language, ADR 0059) and talk to the owner in theirs.

## Read first, then write

Scan the existing decisions in that home. If the new one contradicts an
earlier one, writing the new record is not enough — close the old one in the
same change (below). Never leave the contradiction silent; internal
consistency is the only thing that makes the folder worth reading.

## In a project

`docs/decisions/NNNN-kebab-case-title.md`, unless the project already keeps
ADRs elsewhere (for example `reports/decisions/` or `docs/adr/`): then keep
writing there. Numbering is one increasing sequence per project, and moving it
mid-stream buys tidiness at the cost of traceability. The project's own
conventions always win over this skill's default.

`NNNN` is four digits, increasing, and **never reused** — a deleted or
abandoned ADR leaves its number vacant.

```markdown
---
id: 0007
title: Plain Markdown for the reports layer, not a database
date: YYYY-MM-DD
status: accepted        # proposed | accepted | superseded by 0012 | deprecated
deciders: [<handle or "the maintainer">]
supersedes: []
---

## Context

What made this decision necessary, and the constraints as they stood — this is
what keeps the decision from looking "wrong" later, when they change.

## Decision

One sentence, imperative: "The reports layer is stored as plain Markdown in git."

## Rationale

Why this, and **why not the alternatives**. An ADR with this section empty is
worthless.

## Alternatives considered

| Alternative | Why not |
|---|---|
| SQLite + full-text search | Unreadable in a git diff, extra dependency |

## Consequences

- **Upside:** ...
- **Cost:** ... (every real decision has one; with no cost it is a preference)
- **Cost to reverse:** low / medium / high
```

A contradiction: set the old ADR's `status: superseded by NNNN` and list it in
the new one's `supersedes:`. A rule the decision changes is edited in the
project's `AGENTS.md` as the rule alone, without a date; STATE and the commit
point at the ADR rather than retelling it (ADR 0050). Cite research behind the
decision by link and say in your own words what it showed.

## In a vault

The owner's decisions are notes: `type: decision`, created from
`.claude/templates/decision.md`, kept in `notes/` with an `INDEX.md` row while
they are live and moved to `archive/` once superseded or reversed
(`docs/DECISIONS.md` § Recording your own). The vault's `docs/decisions/` is
the template's own record — never write the owner's decisions there.

- A vault decision is about the owner's life, work, the vault itself, or a
  choice that crosses projects. One project's technical decision belongs in
  that project's repo, written from a session there.
- Run the write gate (`.agents/write-gate.md`): NOOP first, then the
  neighbour step (`node scripts/note-neighbours.mjs "<subject>"`), and close
  in the same commit what the new decision makes stale.
- Fill the template's sections — context, the decision in one sentence,
  expected outcome concrete enough to score at `review_by`, rejected
  alternatives with the one reason each lost, a pre-mortem. `Outcome` stays
  empty until `review_by`.
- Status is `accepted | superseded | reversed`. A contradiction sets the old
  note's `status: superseded` (or `reversed`), `superseded_by: [[new-note]]`
  and `valid_to:`, and moves it to `archive/`; the original text stays as
  written. The vault has no `proposed`: a decision still contested is not
  recorded yet — leave it an open question.
- Give the note at least one outbound `[[wikilink]]` (its topic page, or the
  decision it supersedes) and add the line it changes to the subject's topic
  page.

## Rules

- **When not to write one:** anything cheap to undo — a variable name, a
  formatting preference, a throwaway script. A bloated decisions folder goes
  unread, and that is the biggest risk to it.
- **When you must:** data models, external dependency choices, protocols and
  schemas, directory architecture, security boundaries — anything expensive
  to reverse.
- Decisions are **never deleted**. One that turns out wrong is superseded or
  reversed; the record of a wrong decision is context too.
- In a project, `status: proposed` is a real state: a contested decision stays
  there rather than being written `accepted` and forgotten.
- Commit only the paths this skill wrote, by name, when the session commits.
