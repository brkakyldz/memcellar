---
name: truth
description: Collects what is true now from the owner, claim by claim with selectable options, writes it to one living page (notes/current-truth.md), then closes, archives or fixes every page that contradicts it and rebuilds core/USER.md, core/MEMORY.md and INDEX.md from it — each step on the owner's approval, owner pages untouched. A re-run asks only about sections not confirmed in the last N days. Use when the owner says "what's true now", "clean up the vault", "my notes are out of date", "ground truth", "the vault keeps answering with old facts", the same in their language, or invokes /truth. Not for adding one new fact (that is the ordinary write gate) or for a structural check (/audit).
argument-hint: "[--stale <days>]"
---

# Truth

A vault rots in one way above all: pages that were true once keep answering.
Nothing marks them stale, so a fresh session reads them as current. In the
reference instance a cleanup run this way took the vault from 146 notes to
74, removed always-loaded lines that had stopped being true, and a fresh
session then answered 15 of 15 test questions right — 13 of which stale pages
used to get wrong.

The method: **ask the owner, don't infer.** The vault cannot tell you which
of its own claims still hold; only the owner can. Everything after the
interview is mechanical and runs on lists the owner approves.

Contracts this obeys: `.agents/write-gate.md` (§ 4 is how a page is
closed), `AGENTS.md` § Memory rules and § Note conventions (bi-temporal
keys), ADR 0055 (page types), ADR 0059 (the vault's language), ADR 0060
(owner pages). Talk to the owner and write pages in the vault's language.

## 0. Before anything

- Clean tree, or only files you will not touch: `git status --short`.
  Another task's dirty file is not yours to commit.
- **Tag the starting point:** `git tag pre-truth-<YYYY-MM-DD>`. Every later
  step can be undone from it, and the owner can diff against it. The tag
  stays local unless the owner pushes it.
- **Re-run mode.** If `notes/current-truth.md` exists, read each section's
  `confirmed:` date. With `--stale <days>` (default 90), only sections
  confirmed longer ago than that are asked again; say which ones, and which
  are skipped as fresh, before asking anything. A fresh section is named and
  nothing more: don't quote its claims, comment on them or ask about them
  — the owner confirmed it recently, and re-raising it is the noise this
  mode exists to cut. Extraction (step 1) and the page decisions (step 4)
  also cover only the stale sections' subjects.

## 1. Extract every "true now" claim

Read, completely: `core/USER.md`, `core/MEMORY.md`, every project card
(`type: project`), every topic page (`type: topic`, plus older pages still
typed `knowledge` or `memory`), the owner's to-do page (`kind: todo`), and
`PROPOSALS.md`. Reports, deliverables, logs and `archive/` are dated by
design — skip them.

A claim is any sentence a fresh session would read as a fact about now: a
role, a focus, a project's state, a tool or subscription in use, a person or
company and the relation to them, a rule about how the owner wants work
done. Record each with the page(s) that state it. One claim stated on five
pages is one claim with five sources — the duplicates are what the later
steps clean.

**Group** the claims, in this order, and drop empty groups:

1. Me and current focus
2. Projects
3. Tools and subscriptions
4. Work and career
5. People and companies
6. How I want to work

## 2. Ask, group by group

For each group, ask about every claim **with selectable options** — the
question tool in Claude Code (several questions per call, a few calls per
group), a numbered list with lettered options elsewhere:

- **True** — still holds as written.
- **Changed** — and what it is now (the owner types it).
- **Dropped** — no longer true; nothing replaces it.
- **Don't know** — leave it marked unconfirmed.

Phrase each claim the way the vault states it, with the date of the page
that says it, so the owner sees what a fresh session would read. Close each
group with **"Anything missing in this group?"** — the claims the vault never
held are often the ones that matter most.

Never answer for the owner. A claim you could "obviously" mark true from a
recent page is still asked: recency on the page is exactly what failed.

## 3. Write the truth page

`notes/current-truth.md` — a topic page (`.claude/templates/topic.md`), one
`##` section per group, each section starting with
`confirmed: YYYY-MM-DD` on its own line. Short lines, one fact each, in the
owner's words where they gave them. "Don't know" claims go under an
*Unconfirmed* sub-list in their section. Link the subject pages that hold the
detail. It is the owner's confirmed view, so it outranks every other page
when they disagree — say so in its first line. Add it to `INDEX.md` and link
it from `notes/home.md` if that page exists and is not an owner page.

In re-run mode, update only the sections asked about, bump their
`confirmed:`, and bump the page's `updated:`.

## 4. Per-page decisions — one list per group, approved before any change

For every page that stated a claim, decide one of:

| Decision | When | What happens |
|---|---|---|
| **fix** | the page's subject is still live; only some lines are wrong | edit the lines to the truth page, bump `updated:` |
| **close** | the page is contradicted but must stay readable — linked from elsewhere, or the old belief is itself worth keeping | `valid_to: <today>`, `superseded_by: "[[current-truth]]"` (or the page that now holds it), and a visible first body line `> **Superseded <today>:** <what changed> → [[...]]` |
| **archive** | the subject is over (a dropped project, an old job search, a tool no longer used) | `git mv` to `archive/`, fix the links that pointed at it |
| **leave** | it agrees with the truth page | nothing |

A contradicted page that stays is **closed, never just tagged** — a
`stale` tag or a "may be outdated" note leaves the old fact answering.
Merging two pages on one subject is a fix of the first plus a close (or
archive) of the second.

Show the list per group as a table — page, decision, one-line reason — and
apply it only after the owner approves that group (they may change any row).
Apply a group, run `node .claude/hooks/checks.mjs`, then move on.

**Owner pages** (`author:` in frontmatter, ADR 0060) are never edited,
closed or archived. List them separately at the end: page, the line that is
now wrong, what the truth page says. The owner decides; the agent changes
one only when they ask for that change.

## 5. Rebuild Tier 0 from the truth page

- **`core/USER.md`** — who the owner is now (role, location, language,
  communication style, current focus), from sections 1, 4 and 6 of the truth
  page. Budget 2000 characters. Show the diff and apply on yes. `USER.md`
  holds what the owner told you — never anything from an external source.
- **`core/MEMORY.md`** — one line per durable fact, each pointing into
  `notes/`; drop every line the truth page contradicts or that points at an
  archived page. Budget 4000 characters. Show the diff, apply on yes.
- **`INDEX.md`** — remove archived pages, add new ones, reword rows whose
  page changed meaning.
- **`core/IDENTITY.md`** is protected: if a section of it is now wrong,
  propose a diff and let the owner apply it.

## 6. Finish

- `node .claude/hooks/checks.mjs` and `node scripts/brain-doctor.mjs`; fix
  what this run broke (dead links to archived pages, index rows).
- Commit per group, explicit paths only, subject
  `truth: <group> — <n> fixed, <n> closed, <n> archived`; Tier 0 and the
  index in one last commit. Never stage the whole tree.
- **Offer the answer test.** From the confirmed claims, propose 10–15
  questions with expected answers for `.claude/eval/truth-questions.md`
  (format in `/truth-test`), marking as **trap** every question whose old
  pages would have given a different answer. Write it only on the owner's
  yes — the key lives outside `notes/` so the vault never reads it.
- Session log entry with one `outcome` line: counts before and after
  (`notes/` pages, `USER.md` and `MEMORY.md` characters), the tag name, and
  `verification: agent-claimed` until `/truth-test` has run.

## What this never does

- Decide a claim's truth from the vault itself.
- Edit an owner page, `core/IDENTITY.md` or `AGENTS.md` without the owner
  applying it.
- Delete a page — archive is the floor.
- Write a fact that came from a web page or a document into `USER.md`.
