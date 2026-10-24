---
name: closeout
description: The last step of project work — brings the repo's docs/CURRENT_STATE.md up to date, writes the run report of an autonomous run, removes this task's merged worktrees, and commits exactly the paths the task wrote under a subject that reads as the project's history. It never touches the vault. Use when the owner says "closeout", "wrap up", "close the session", "finish the work", and at the end of every autonomous run without being asked.
---

# Closeout: leave the repo true

Status lives in the project repo, committed (ADR 0045). In the reference
instance, status rotted everywhere but one living state file, completion
reports vanished into chat, and no coding session ever resumed from a vault
note. Closeout makes the next session start from the repo.

**The vault is out of reach** (ADR 0052). A project session neither reads nor
writes the vault; a vault session may read this repo, read-only, when the
owner wants the cross-project view (ADR 0056). Everything closeout writes
lands in this repo, except the two things that belong to every project:
owner-wide lessons and cross-project traps, which go to the owner's
user-level kit (steps 5 and 6).

**One fact, one home** (ADR 0050). Where we are is STATE; why is an ADR; what
happened is `git log`; what a run checked is its report. Closeout updates
each home once and never restates one in another. In the reference instance
a single changed decision was once written into a worklog, STATE, a vault
log, the commit message, the plan and `AGENTS.md` — eleven files for one
fact. `docs/WORKLOG.md` is retired: an existing one is frozen history, and
nothing appends to it.

Milestones, gates, blockers and the next action live in
`docs/CURRENT_STATE.md` and nowhere else. A copy is right for a day and wrong
afterwards, and nothing says which day.

The formats (C1, C3) are in `references/execution-contract.md`. Read it
before writing any file below for the first time in a repo.

## Before the steps

Settle three facts from the repo, not from memory of the chat:

- **Paths this task wrote** — `git status --short` against what you know you
  touched. A dirty file you did not write belongs to another task; another
  session, in either runtime, may be working in this checkout.
- **Run or session** — a run is work that proceeded without the owner in the
  loop: a handoff executed end to end, an automation, "do the next milestone,
  don't stop". An interactive session is not a run.
- **Interrupted run** — if STATE shows one, handle it first (last section).

Each step runs or is skipped with a one-line reason. The skip line is part of
the output; a silent skip reads the same as a forgotten step.

## 1. STATE — `docs/CURRENT_STATE.md` (C1)

- Bring milestones, open gates, blockers and next to what is true now. "Not
  run" is never PASS; an unverified claim is IN_PROGRESS or OPEN_GATE.
- Commit the STATE edit together with the code it describes (step 4); a
  docs-only follow-up commit is also fine. The freshness rule only asks that
  no commit after the latest STATE commit touches code. `as_of` records the
  sha your checks ran against (usually HEAD before the commit); it is
  information, not a key.
- No STATE, but the repo has execution work (milestones, a plan being
  implemented, runs)? Offer to create it from the C1 template and create it
  only on the owner's yes. A repo without execution work gets none.
- Status lives here only. Don't add "Status:" lines to plans, READMEs or
  architecture docs on the way past.
- If the repo keeps review findings (for example `docs/reviews/findings.md`,
  written by a review step), a CRITICAL or IMPORTANT finding that is neither
  an Open gate here nor named in a commit subject becomes an Open gate now,
  and the findings file is committed with this STATE edit even though the
  reviewer wrote it.
- A decision this session made that is expensive to reverse gets an ADR in
  `docs/decisions/`; STATE and the commit point at it, never retell it. A
  rule it changed is edited in `AGENTS.md` as the rule alone, without a date.

## 2. Run report — `docs/runs/YYYY-MM-DD_<slug>.md` (C3)

Autonomous runs only. Fill the C3 template with what nothing else holds:
exact checks with results ("not run" is a line, not a silence), acceptance
IDs with evidence paths, assumptions, cost from the runtime's own numbers or
`unknown`. Commits are `base_sha..head_sha` in the frontmatter, open gates
and next live in STATE; the report does not copy them. Then set STATE
`active_run: none`. The chat summary is derived from this file and STATE,
never the other way round.

## 3. Worktrees

`git worktree list`. For each worktree this task created: if
`git -C <wt> status --porcelain` is empty and its branch is merged
(`git merge-base --is-ancestor <branch> <target>`), run
`git worktree remove <wt>`. Never `--force`. List every other worktree with
why it stays: dirty, unmerged, or not this task's. Branches are left alone.

## 4. Commit

The subject is the project's history line — `git log --oneline` is what the
next session reads instead of a worklog. Say what changed, and on a
milestone its result: `M3 PASS: editor e2e suite 10/10, selection race
fixed`. A direction change says so: `Scope: drop the PDF export (ADR 0004)`.

Only the paths this task wrote, by name:

```
git add -- <path> <path>
git commit -m "<what the work did>" -- <path> <path>
```

The pathspec on `commit` keeps anything another task staged out of yours.
Never `git add -A` / `git add .`, never `--no-verify`; when a commit hook
warns or blocks, fix the cause. If the tree is red and a gate refuses, report
the files as uncommitted instead of retrying. Never push unless the owner
asked in this session.

## 5. Lessons

If the owner corrected how the agent works this session and it was not
captured yet, run `/lesson` — once per behaviour, not once per message.
Feedback on a single deliverable is not a lesson; it belongs in that
project's own rules (the gate in `/lesson`). `/lesson` picks the store — the
kit by default, this repo's `docs/lessons/` only when the correction is tied
to this repository — and commits its own paths there. If a lesson topic
touched this session is left `routing: pending`, name it in the closeout
summary with its proposed change.

## 6. Cross-project traps

Ask one question: **did this task hit something that would bite any
repository using the same library, tool or machine?** A function that behaves
unexpectedly, a shell or OS quirk, a harness limit. Not a design choice, and
not something specific to this repository: a pattern read off one repository
stays in its docs until a second one uses it (ADR 0056).

If so, append it to the matching file in `<kit>/reference/` (`$BRAIN_KIT_DIR`,
else a `reference/` folder next to the user-level instruction file). Write a
heading that names the trap, then what happened, the fix, and the repository
and date it was found. Create a new topic file only when no existing one fits,
and add its one trigger line to the user-level file ("before <kind of work>,
read `reference/<file>.md`"). Commit it in the kit by path. Most tasks hit
nothing: say "no new trap" and move on.

## Finish

One line per step, in the language the owner converses in: done (with the
path or sha) or skipped (with the reason). Derive it from the files just
written.

## Interrupted runs (C3)

STATE `active_run` names a report that is missing or has no `status:` — an
earlier run died mid-way. Before step 1: read `git log <base_sha or
as_of>..HEAD` and `git diff` for what actually landed; re-run the checks the
run owed, assuming nothing passed; correct STATE to what is true; then finish
the run or write its report as `ABANDONED` and set `active_run: none`.

## What this skill does not do

- Push unless asked.
- Read or write anything in the vault — no log, no card, no `MEMORY.md`, no
  lesson there. The kit is not the vault: steps 5 and 6 may write there.
- Append to `docs/WORKLOG.md`, or rewrite a frozen WORKLOG or earlier run
  reports; they are evidence.
- Copy one home's fact into another.
- Create a STATE file without the owner's yes.
- Stage, commit or remove anything another task owns.
