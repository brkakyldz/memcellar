---
name: file
description: Files an analysis produced in this conversation into the vault as the right kind of page — an update to a topic page, a dated report, or an expiring deliverable — through the write gate, so a good answer does not die in the transcript and a one-day answer does not pose as knowledge. Use when the owner says "file this", "keep this analysis", "put that in the notes", the same in any language, or invokes /file.
---

# File

A comparison, an analysis, a connection worked out in conversation is worth
what an ingested source is worth — and by default it evaporates when the
session ends. This files it under the ordinary rules, as the type its lifetime
calls for (ADR 0055): most answers update a topic page or become a dated
report; a list made for one task is a deliverable that expires.

Contracts: `.agents/write-gate.md` (the procedure every vault writer runs),
`AGENTS.md` § Distillation and § Note conventions, ADR 0055, and the ADR 0012
boundary spelled out below.

## Trigger — the owner's explicit request only

`/file`, or the owner saying "file this", "keep this analysis", "put that in
the notes" — in whatever language they say it.

**Never on inference.** An answer you are pleased with is not a trigger. This
matters more here than anywhere else in the vault: ADR 0012 hard-vetoes facts
sourced from the assistant's own prior output, because an agent that files its
own reasoning and later reads it back has corroborated nothing — it has looped.

What lifts the veto is the owner asking. Their request is a *new user
utterance*, which is one of the three forms of independent evidence ADR 0012
names. So the rule is exact: **the ask is the corroboration, and it covers
filing the analysis — not promoting anything in it to `MEMORY.md`.**

If it is ambiguous whether they want this filed or are just responding, ask in
one line rather than writing.

## Which skill is this

| The material is | Skill | Lands in |
|---|---|---|
| A correction they made to the agent | `/lesson` | the kit, the repo or the vault, by ADR 0056, verbatim |
| The owner's own words, as they said them | `/note` | `my-notes/`, the owner's language |
| An external document | `/ingest` | a report in `reports/`, plus its topic page |
| Analysis worked out together in the session | **`/file`** | a topic page, a report or a deliverable, English |

## Steps

### 1. Scope it

What exactly is being filed — the whole thread, or the one table that was
useful? Default to the smallest self-contained piece that stands on its own.
If it is obvious, say what you scoped it to; if it is not, ask.

### 2. Run the write gate

`.agents/write-gate.md`, all four steps: NOOP first; type it by the three
questions (deliverable → `outputs/`, report → `reports/`, otherwise the
subject's topic page); `node scripts/note-neighbours.mjs` for the pages on the
same subject; and close in this commit whatever this filing makes stale.

**Updating an existing topic page is the better outcome and the more common
one.** A new topic page is right only when the subject is genuinely new; a
`-v2` is never right. Decide per fact: ADD / MERGE / SUPERSEDE / NARROW / NOOP
— NARROW cuts a fact back to what its evidence supports. Supersession closes a
window and never overwrites (`valid_to`, `superseded_by`, plus the visible
line in the body).

Say which type you chose, and why, in the one-line confirmation — the owner
is the one who can tell you a "report" is really a plan they still follow.

### 3. Rewrite it as a page, not as a transcript

This is the step that gets skipped and it is the whole job. A chat answer and a
wiki page are different artifacts:

- **Drop the conversational frame.** No "as we discussed", no "you asked
  about", no second person. A future session has none of this context.
- **State the conclusion first**, then the reasoning that supports it. In chat
  the reasoning arrived first; on a page it goes second.
- **Keep the evidence, drop the hedging.** Numbers, file paths, dates, counts —
  those are what make the page worth having. "Probably", "it seems", "I think"
  either become a confidence marker in frontmatter or become a claim.
- **In the vault's language**, per `core/IDENTITY.md`, even when the
  conversation was in another one. An `aliases:` entry in the conversation
  language is welcome: search is lexical, and the alias is what lets a
  question in the owner's language find the page.

### 4. Frontmatter

The template for the type: `.claude/templates/topic.md`, `report.md` or
`deliverable.md`. A topic page gets `updated: <today>`; a report its date in
the filename and `topic:`; a deliverable `expires:`. `status: seedling` on a
topic page unless it has already been used in real work. Date anything
perishable. Add two fields the templates do not carry — on a merged section,
as a one-line provenance note under its heading instead:

- `source: filed from a session, YYYY-MM-DD, on the owner's request` — plus
  the external source, if the analysis rests on one; that part is mandatory
  and carries through every later merge.
- `confidence: low` — the page is the agent's own output until something
  independent confirms it (see § Standing rules).

`status: evergreen` needs the 1–2 sentence top-line distillation at the head of
the note — if the idea cannot be stated that briefly it is not evergreen yet.

### 5. Link it in

≥1 outbound wikilink, short form. Add the inbound link from the one or two
existing notes where a reader would look for this.

### 6. `INDEX.md` and the log

A new topic page gets a row in the right category with a one-line
description; update an existing row if the merge changed a page's scope. A
report or deliverable gets no row — its topic page lists it. Run
`node .claude/hooks/checks.mjs` before the commit. Then a log entry tagged `discovery`
(or `decision` if the analysis settled a choice), naming the file and whether
it was created or merged.

## Standing rules

- **Never `MEMORY.md`, never `USER.md`, never `core/IDENTITY.md`.** Filing an
  analysis is not a durable-fact promotion. A fact inside it reaches
  `MEMORY.md` only through the normal corroboration gate, on a later
  independent occurrence.
- **Never file the same analysis twice.** If it merged into an existing note
  once, the second ask is an update to that note.
- **A filed page is not evidence for itself.** When a later session reconciles
  facts, a page filed this way counts as the agent's own output — that is what
  its `source:` and its low confidence are recording.
- Confirm in one line: the file, its type and why, created or merged, what it
  closed, and the `INDEX.md` row.
