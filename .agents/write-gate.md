# Write gate — the one procedure every vault writer follows

ADR 0055 is the decision; this is the procedure. `/file`, `/ingest`,
`/curator`, and any outside skill that writes into the vault (a research
pipeline, for one), run these four steps before they write a page.

Two writers are exempt, each for its own reason. `/note` writes `my-notes/`,
the owner's own words on their request, and nothing here applies to it.
`/lesson` follows ADR 0048 instead: a correction is captured verbatim, its
"find the topic" step is its neighbour step, and it has no type to choose.

## 1. NOOP first

Write nothing, and say so in one line, when what the page would say:

- is already written in the vault, the repo or the user-level rules;
- can be derived from a file that exists — including prose that only
  describes a script, skill or rule whose file is right there;
- is "what happened, when" — that is `git log` and the session log;
- is a config a program outside the vault reads — it lives with the program.

## 2. Type it — three questions, in order

1. **Is its value in its form — something to act on, then done with?**
   → `deliverable` in `outputs/YYYY-MM-DD_<slug>.<ext>`, template
   `.claude/templates/deliverable.md`, `expires:` 30 days out unless the owner
   says otherwise.
2. **Sourced claims about the world as of one date, which no one will keep
   current?** → `report` in `reports/YYYY-MM-DD_<slug>.md`, template
   `.claude/templates/report.md`, `confidence: low`, `source:`, `topic:`.
3. **Otherwise it changes what is true now about a subject** → update that
   subject's `topic` page in `notes/` (template `.claude/templates/topic.md`),
   bump `updated:`. A choice made along the way is also a `decision`.

Tie-breaks, from the ADR: *wrong* in three months because the world moved →
report; *useless* because the task is over → deliverable; both → report. A
plan is a topic only while the owner still acts on it. A dated assessment of
the owner is a report; their topic page keeps the one-line conclusion.
Perishable figures (prices, counts, postings) always go in a report. Work tied
to a repository is tracked there, not here. One page holds one type — split
what holds two.

A report or a deliverable still touches the living layer: its topic page
gets the one or two lines that changed and a link. If no topic page exists,
creating one is part of the write.

## 3. Find the neighbours

```bash
node scripts/note-neighbours.mjs "<subject in English>" --tags <tags> [--slug <topic-page>]
```

Run it again with the owner's-language words if they asked in another
language. Open every page it lists above 0.5 and any it flags as a version.
For each, decide ADD / MERGE / SUPERSEDE / NARROW / NOOP (`AGENTS.md` §
Memory rules). A flagged `-v2` is never answered with a `-v3`: update the
first page and archive the rest.

## 4. Close what the write made stale

If this write changes what is true, every neighbour that still says the old
thing is closed **in the same commit**: `valid_to: <today>`,
`superseded_by: "[[new]]"`, and a visible first line —
`> **Superseded <today>:** <what changed> → [[new]]`. A tag or a comment that
it "may be stale" is not a close. Check the owner's topic page and
`core/MEMORY.md` too: a pointer line there that now says the old thing is a
neighbour like any other.

Then the ordinary finish: ≥1 outbound wikilink, an `INDEX.md` row for a new
page in `notes/` (reports and deliverables are listed on their topic page, not
in the index), and `node .claude/hooks/checks.mjs` before the commit.
