---
id: 0055
title: A note is typed by its lifetime when it is written — topic pages live, reports are dated, deliverables expire
date: 2026-10-24
status: proposed
amends: [0035]
related: [0012, 0035, 0043, 0048, 0050]
---

# 0055 — Notes are typed by lifetime at write time

## Context

`notes/` had one working type for almost everything: `knowledge`. A research
run, a chat answer kept with `/file`, a 637-row job listing, a one-day
inventory of the owner's machine and a description of how a subject stands
today all landed there the same way, with the same frontmatter and the same
`INDEX.md` row.

The reference instance read its own store on 2026-10-24, two months and 146
notes in. About half of `notes/` was dated research output, mostly 10–30 KB
each, and 85 notes were still `seedling`. Three failure shapes showed up again
and again:

- **Perishable output stored as knowledge.** Listing dumps, idea lists and
  machine inventories were written for one day's use. They were still
  answering questions weeks after `review_by` had passed.
- **Versions instead of updates.** Target lists v1, v2 and v3 were all
  `status: active`, and no page said which one was current.
- **Contradictions nobody closed.** When a decision changed (a runtime
  paused, a project dropped), every note describing the old state kept
  saying it.

In the reference instance one global research skill wrote most of these, and
a maintenance pass that ran twice in that period caught none of them. A
cleanup the same day archived 68 notes and rebuilt the Tier-0 files from an
interview with the owner.

Outside research (2026-10-24) found the same direction in the field.
Claude Code types every auto-memory and skips what is already written down.
The one admission-control study that measured it (A-MAC, arXiv 2603.04549)
found the content-type prior was the strongest single factor. No system or
PKM method had a class for agent-produced deliverables.

## Decision

1. **Every page gets its type before it is written, and the type is decided
   by how long the page stays true.** One page holds one type.

   | Type | What it is, in one sentence | Home | Lifetime |
   |---|---|---|---|
   | `deliverable` | Its value is in its form: something to act on (pick from, apply to, click through, follow once), useless once that task is done | `outputs/YYYY-MM-DD_<slug>.<ext>` | `expires:` date, 30 days unless set; then archived |
   | `report` | Sourced claims about the world as of one date, worth keeping as "what was known then" | `reports/YYYY-MM-DD_<slug>.md` | Write-once. Ages by its date; only a supersession line is ever added |
   | `topic` | How one subject stands now, kept current: a domain, a tool, an activity with no repository (a job search), a plan the owner is still following, the owner themself | `notes/<subject>.md` | Updated in place; carries `updated: YYYY-MM-DD` |
   | `decision` | A choice, its reasons and the alternatives it beat | `notes/` (`AGENTS.md` § Decisions) | Accepted, then superseded or reversed, never edited |
   | `project` | The card for one repository: why it exists, where it lives, what it taught | `notes/<project_id>.md` | Updated in place; no live status (ADR 0045) |
   | `playbook` | Steps to follow, proven by use | `notes/` | Revised deliberately (`AGENTS.md` § Lifecycle) |

   One subject has one topic page. The page about the owner is a topic page
   too: what is true about them now, in sections each dated by when it was
   last confirmed. `knowledge` and `memory` are retired as write-time types.
   Existing pages are reclassified once, by hand.

2. **The write gate is three questions, asked in order.**

   1. Is its value in its form, something to act on and then done with?
      Then it is a `deliverable`. A fact inside it that will still matter goes
      to its topic page as a line.
   2. Does it make sourced claims about the world as of one date, which no
      one will keep current? Then it is a `report`, and its topic page gets
      the one or two lines that changed, plus a link to the report.
   3. Otherwise it changes what is currently true about a subject. Then it
      updates that subject's topic page, or creates one if the subject has
      none. A choice made along the way is also written as a `decision`.

   **The deliverable–report tie-break.** Ask whether the page would be
   *wrong* in three months because the world moved, which makes it a report,
   or *useless* because the task is over, which makes it a deliverable. When
   both are true, it is a report: the sources survive and nothing is lost.

   **Four tests that settle the usual hard cases.**
   - *Still followed?* A plan, strategy or study sequence is a `topic` while
     the owner is still acting on it, meaning they changed it, used it or
     said it holds in the last 30 days. Otherwise it is the deliverable or
     report it was written as. When only the owner can tell, ask once and
     record the answer in `updated:`.
   - *The owner is part of the world.* A dated assessment of the owner
     (a skills test, a profile review) is a `report`. The owner's topic page
     keeps the current conclusion in one line, with a link to it.
   - *Stable or perishable?* A topic page keeps the synthesis that stays
     true. Prices, counts, postings and anything else that decays go in a
     dated report, which the topic page links.
   - *Repository or vault?* Work tied to a repository is tracked in that
     repository. Work with none, such as a job search or the vault's own
     upkeep, is tracked on a topic page.

   **NOOP comes first.** Nothing is written when what the page would say is
   already written somewhere. Nothing is written either when it can be
   derived from a file that exists, and that includes prose describing a
   mechanism whose scripts, skills or rules are in the repository. "What
   happened, when" is `git log` (ADR 0050). A file that a program outside
   the vault reads, such as a routine's config or mandate, lives with that
   program. A registry that the vault's own skills read (source roots, for
   example) is a topic page. The reasons behind a rule live in the decision
   record that made the rule. The policy pages that `AGENTS.md` names as the
   full rationale for its rules are that record. They are kept as they are
   and never restated elsewhere.

3. **A page that holds two lifetimes is split.**
   - Research that ends in a choice becomes a report plus a decision.
   - A tracker that is updated as work moves becomes a topic, or a list in
     the repository the work belongs to.
   - A section written for one-time use, such as draft posts inside an
     analysis, becomes a deliverable.
   - A report that was edited after its date is frozen at its last edit, and
     the part someone kept current moves to the subject's topic page.

4. **No write without its neighbours.** Before writing, the writer lists the
   pages on the same subject: matching titles, aliases and tags, and the pages
   that link there. For each, it decides ADD / MERGE / SUPERSEDE / NARROW /
   NOOP, as the existing rules require.

   When the write changes what is true, every neighbour that still says the
   old thing is closed in the same commit: `valid_to`, `superseded_by`, and
   a visible first line in the body. Annotating it and leaving it does not
   count.

5. **`INDEX.md` lists the living layer only:** topic, decision, project
   and playbook pages. A topic page lists its own reports.
   `outputs/` and `reports/` get one row each, as folders.

6. **Versions are a smell, except for reports.** Reports are dated readings,
   and a subject may gather many: a newer one supersedes an older one with a
   line, and both stay. For every other type, a name ending in `-v2`, or a
   second page for the same subject, means the first one should have been
   updated. The periodic check reports it.
7. **Eval sets live with the machinery**, in `.claude/eval/`, never in
   `notes/`. A vault must not be able to read its own answer key.

## Rationale

- The failures were all one mistake: a page whose lifetime nobody declared
  was treated as if it lived forever. A type that carries its own lifetime
  makes the default right. A deliverable expires unless someone keeps it, and
  a report is understood to be "as of" its date.
- The question order puts the cheapest exits first. Most of what a session
  produces is a deliverable or a report. In the reference instance the
  living layer was the minority of `notes/`, but it was the part every
  answer depended on.
- Closing neighbours at write time is the one moment when the writer knows
  what changed. A stale stored fact can outweigh fresh evidence at answer
  time (arXiv 2609.01852), so the old page must stop asserting the old
  thing. A tag saying it might be stale is not enough.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep one type, strengthen the maintenance pass | It ran twice over the period and caught none of these; a pass after the fact sees a pile, not the moment of change |
| Tags for lifetime (`#snapshot`) | Tags were already sprawling, and nothing reads a tag at write time |
| PARA folders (Projects/Areas/Resources/Archives) | Classifies by actionability, not by how long a page stays true; a research report is a Resource either way |
| Deliverables outside the vault entirely | Considered; the owner sometimes returns to a list for days. Kept in the vault, in their own folder, with an expiry |
| Auto-merge near-duplicates | Consolidation without a gate degrades memory (arXiv 2605.12978); merges stay proposals the owner approves |

## Consequences

- Two new top-level folders, `outputs/` and `reports/`, each with a README
  contract. The growth gate is met by the 2026-10-24 evidence.
- `/file`, `/ingest`, `/lesson` and any external research skill that writes
  into the vault run the gate and the neighbour step. A shared reference in
  `.agents/skills/` holds the procedure once.
- The compiled checks learn the new types and fields:
  `updated:` on topic pages, `expires:` on deliverables, and no `knowledge`
  or `memory` on newly written pages.
- Test questions about the vault never live inside it. In the reference
  instance's first baseline, three of fifteen answers quoted an answer key
  kept on the page under test. Eval sets live with the eval, outside
  `notes/`.
- One-time migration: reclassify existing `knowledge` pages, move reports
  and deliverables, and repoint links.
- Cost to reverse: medium. Files move and links change, but the types are
  frontmatter and the folders are flat.
