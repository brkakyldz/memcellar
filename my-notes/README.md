# my-notes/ — the owner's own notes

The one folder in this vault that the agent never writes to on its own
initiative. Everything here exists because the owner explicitly asked for it.

Two things to know before writing anything here: **who may write** (this section
and the next) and **what to put in `kind:`** (the table below). The first is a
hard contract; the second is a convention (ADR 0037, amended by ADR 0040).

## The trigger — explicit request only

A file is created or appended here **only** when the owner says so: "note
this", "write this down properly", "add it to my-notes", `/note ...` — or the
same in their own language. Nothing else qualifies — not an interesting
finding, not a decision made in passing, not a fact worth remembering. Those
go through the write gate (`.agents/write-gate.md`) into `notes/`, `reports/`
or `outputs/` in the session they come up, the way everything else does.

If it isn't an explicit instruction, it doesn't land here. When in doubt, ask.

## Untouchable

No automated pass may read-and-rewrite this folder:

- Files here are **not** a queue and are never distilled into `notes/`.
- `/curator` and the structural audit (`/audit`) skip it entirely.
- Nothing here is archived, demoted, promoted, or deleted by an agent.
- The agent may **edit** a file here only when the owner asks for that edit,
  and may **read** it freely (it's searchable context like anything else).

Notes here are allowed to stand alone: the ≥1-outbound-wikilink rule in
`AGENTS.md` does not apply to this folder, and `scripts/link-sweep.mjs` leaves
it out of the orphan report.

## Flat, and classified by `kind:`

**The folder is flat.** One directory, one file per thing, no subfolders. In
the reference instance ADR 0037 opened seven subfolders by kind and ADR 0040
closed them again — the routing question they added at write time was always
answerable from `kind:` alone, and two of the seven never received a file.
Navigation here is search, wikilinks, and one screen of filenames.

One question decides what a file *is*:

> **What you return to by name gets its own file. A thought goes to a topic
> note. A day goes to a dated section under one.**

A person, a company, an idea — you come back to those *by name*, so each is a
file named after itself. Course notes or a reading list are topics that keep
growing, so they are one file per topic with dated sections.

`kind:` records the answer. The starting values:

| `kind:` | What it means |
|---|---|
| `person`, `org`, `place`, `tool` | Anything returned to by name. One file per entity, named after it. |
| `project` | The owner's own thinking about a live project — the personal half of something that may also have a `notes/` page. |
| `idea` | One idea per file: a project, a product, a piece of writing. |
| `course`, `concept`, `vocab` | Course notes, concept write-ups, vocabulary lists. |
| `decision` | The owner's personal decisions and cost analyses — their own ADRs. |
| `goal`, `habit`, `todo` | Goals, habits, to-do lists. |

**A new `kind:` needs a real miss** — a piece of content that honestly fits none
of the above, not a value that feels tidy. Same gate the rest of the vault uses.
Until then, pick the closest honest one and say so.

Nothing enforces this list. `checks.mjs` never scans this folder, and no
hook validates `kind:` — deliberately, because a guard advertised as stronger
than it is costs more than no guard. It is a convention that a reader and an
agent both follow.

## Shape

- **Entities and explicitly requested detailed ideas: one file per thing,
  named after the thing.** `jane-doe.md`, `acme-corp.md`. The filename is the
  wikilink, which is what makes `[[jane-doe]]` readable from anywhere in the
  vault.
- **Everything else: one file per topic**, `kebab-case.md`. A second note on the
  same topic is appended to the existing file as a new dated `##` section, not a
  new file.
- **Filenames are unique vault-wide.** A personal project note must not take the
  name of its `notes/` twin — two `search-agent.md` files break every
  `[[search-agent]]` link in the vault. Give it a free name
  (`search-agent-thoughts.md`) and link the twin in its first line.
- **Written about → its own file. Merely mentioned → a link.** A note *about* a
  person or company gets its own file. A note that only mentions one links to it
  if the file exists, and otherwise leaves the name as plain text. Names never
  returned to individually — a staff roster, a list of attendees — stay as a
  table inside the org's file.
- **In the owner's own language, in their own words.** The English rule in
  `core/IDENTITY.md` covers `notes/` and `core/`; this folder is personal.
  Field names are English so the vault reads as one system.
- **Cleaned up, not reinterpreted.** The agent fixes sentences, adds structure
  and headings — it does not add conclusions, opinions, or "what this means"
  sections the owner didn't say.

## Both hands write, and both are marked

Entity files especially are written from two sources, and telling them apart is
the point:

- **Agent-supplied** — titles, dates, company facts, anything found by research.
  Carries `source:` in the frontmatter and a date in the text, and is treated as
  perishable.
- **Owner-supplied** — how close a relationship actually is, whether an idea
  still excites them, what they decided and why. Written as a
  `> Owner, YYYY-MM-DD:` blockquote (use the owner's name if they prefer) and
  **never rewritten**, only appended to.

The rule exists because of a real error in the reference instance: a
relationship was twice written down as closer than it was, both times
inferred from how things looked from the outside. The correction was one sentence from
the owner. A relationship is asked about, never inferred.

## Frontmatter

```yaml
type: my-note        # always — this means "the owner wrote it", not what it is
kind: person         # what it is; see the table above
created: 2026-09-05  # first write, never changed
updated: 2026-09-05  # this write
tags: [reading, job-search]
related: []          # optional [[wikilinks]]
```

No `status:` — maturity is meaningless here, nothing matures.

Entity files add, all optional: `org:` (a `[[wikilink]]` to the company),
`role:`, `relationship:` (acquaintance / potential contact / colleague /
former colleague — or the owner's own words), `last_contact:` (`YYYY-MM-DD`),
`source:` (required if anything came from research), `aliases:` (other forms
of the name, nicknames and honorifics in the owner's language, so a query
typed the way the owner actually says it finds the file).

The ≥1-outbound-wikilink rule does not apply here; link only when a genuinely
related note exists.

Templates: `.claude/templates/my-note.md`, `.claude/templates/my-entity.md`.
Skill: `/note` (`.agents/skills/note/SKILL.md`). Decisions: ADR 0037, amended
by ADR 0040 (`docs/DECISIONS.md`).
