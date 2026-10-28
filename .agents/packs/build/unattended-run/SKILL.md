---
name: unattended-run
description: "Use only to carry an accepted plan's remaining milestones through one autonomous run in its own worktree and branch, in a repo whose execution layer exists (repo-bootstrap FINALIZE — CURRENT_STATE, AGENTS.md commands, acceptance commands). PREPARE resolves scope and emits the paste-ready launch prompt, RUN executes it, RESUME finishes an interrupted run. Triggers: \"prepare an unattended run\", \"run the next milestones without me\", \"resume the interrupted run\", or the same request in the owner's language. Do not use for a single change, for planning, or in a repo without that layer."
---

# Unattended run

One launch carries a plan through its milestones with nobody at the keyboard;
each milestone is an internal gate, and the run stops only for the four
reasons below. The rules are the project's `AGENTS.md`; this is the loop
around them. The launch prompt is `references/launch-prompt.md`.

## Preconditions

PREPARE checks each; a miss stops it, named, for `repo-bootstrap` to fix.

- `AGENTS.md` has the execution sections; `docs/CURRENT_STATE.md` is fresh (no
  code commit after the last one touching it) or is corrected first.
- Every milestone in scope has acceptance IDs with exit commands (or marked as
  owner judgement) and one product-level acceptance command.
- `AGENTS.md` § Commands has a *Full offline gate* row of commands that ran
  green — or the first milestone in scope is the one whose acceptance creates
  the offline suite and fills that row.
- Held-out scenarios cover the milestones in scope that have a product-level
  surface, landed by `scenario-author` in a `holdout: …` commit with
  `LOCK.json`, or the `AGENTS.md` Held-out row records the owner's waiver.
  Not a stop: PREPARE fills it (step 3).
- No other run on overlapping scope: `git worktree list`,
  `git branch --list "run/*"`, STATE's `active_run`.
- Live acceptance in scope has an allowance the owner approved, with its cost,
  left in the ledger, and credentials in the worktree — gitignored secrets are
  absent there; the owner places them, the agent never copies them. Otherwise
  those IDs end `BLOCKED(live-verification)`.

## PREPARE — in the primary checkout

1. Read `AGENTS.md`, STATE, `git log --oneline -15` and the plan.
2. Scope: from the first milestone not PASS to the first stop the plan itself
   names — quote the sentence — or the plan's end. With no such sentence, cut
   by dependency depth and say so. Never mint a milestone ID the plan lacks:
   two sessions that each numbered their own slice once produced two
   different milestones under one ID.
3. Held-out: if the precondition is unmet, run `scenario-author` for the
   scope now, in the primary checkout, and commit its landing before the
   worktree exists — a worktree made earlier would not carry the scenarios.
   This session is the builder: it briefs the author (a fresh subagent, not a
   fork, or the other runtime) and never writes a scenario itself.
4. Isolate: `git worktree add ../<repo>-run-<slug> -b run/<slug>` (a sibling;
   a nested worktree gets swept by the parent's linters and watchers), then
   the documented setup. Several sessions in one checkout overlap each other's
   files; use the primary checkout only when the owner says so.
5. UI acceptance: a preview or browser tool may be serving the primary
   checkout, not the worktree. Start the worktree's app from the worktree on
   ports no other checkout uses, and confirm a page shows a change only the
   run has before its screenshot counts.
6. Emit the launch prompt with every slot resolved, including the write scope
   and the live allowance (none, or bucket and calls). A leftover placeholder
   becomes a question, and a run that asks a question never starts.
7. Stop. The owner opens a fresh session *in the worktree* and pastes it; a
   session rooted elsewhere reads the wrong `AGENTS.md` and runs the checks
   against the wrong tree.

## RUN — in the run worktree

**Start.** Confirm directory and branch. Create `docs/runs/YYYY-MM-DD_<slug>.md`
from `docs/runs/TEMPLATE.md` (`status` empty, `base_sha`, `started`; add a
`## Plan refresh` section if the template has none), set STATE `active_run` to
it and `branch` to `run/<slug>`. Run the full offline gate on the base and
commit both files: a red base is a FAIL before any work.

**Per milestone, in plan order:**

1. Re-anchor: STATE, `git log --oneline <as_of>..HEAD`, `git status`, the
   milestone's plan section. Promote findings: each CRITICAL or IMPORTANT id in
   `docs/reviews/findings.md` that is neither a STATE Open gate nor named in a
   commit subject becomes one (`REVIEW <id> <severity>: <line>`). If this
   milestone builds on the code it names, fix it now, name the id in the
   commit subject, and drop the gate.
2. Refresh, then implement. The plan was written before this code existed, so
   a late milestone's section names files and interfaces earlier milestones
   built differently. Check the section against HEAD: every file, module,
   function, table, endpoint and command it names exists as named or is one
   this milestone creates; its premises — earlier milestones' output, the
   Verified assumptions rows it cites, the run's assumptions so far — still
   hold. Then edit the section's **how** to match the code: paths, names,
   signatures, step order, build notes; an exit command may be re-pointed
   (path, flag), never re-meant. The **what** is frozen: scope, requirement
   and acceptance IDs and what each asserts, the product-level command, live
   allowances, the plan's stops, the Verified assumptions table, and every
   other milestone's section. A gap only the what can close is stop
   condition 3, never an edit. Write one Plan refresh line even when nothing
   changed: `<M>: no change` or `<M>: <what changed> — <file:line>`.
   Implement the milestone as the refreshed section scopes it; never narrow
   it. Map every acceptance ID to the test that proves it and write the
   missing ones — never under `tests/acceptance/holdout/`.
3. Focused check → fix, until green. Then the full offline gate → fix.
4. Product-level acceptance, including the held-out scenarios whose titles
   name this milestone's acceptance IDs → fix the product, never the
   scenario; one that looks wrong is an Open gate
   `BLOCKED(unreliable-oracle)` with the scenario id, the line and the
   contract clause it contradicts, and the product is still built to the
   spec. A scenario titled `@needs-<ID>` for an ID not built yet is skipped.
   Live checks go through the ledger, reserved before each call, and only
   within the allowance the launch prompt names — a paid call it does not
   authorize is never made; no key or allowance means
   `BLOCKED(live-verification)` for those IDs, with the dependency assessment
   on STATE's Blockers line.
5. Self-review with the `AGENTS.md` severities; fix CRITICAL and IMPORTANT,
   rerun what they touched.
6. Before committing: the full offline gate is green on this tree; the
   held-out lock check passes
   (`node <scenario-author skill folder>/scripts/lock.mjs check`, that folder
   being a sibling of this skill's); and the fence holds — branch `run/<slug>`,
   working directory the worktree, `git diff --cached --name-only` inside the
   launch prompt's write scope and nothing under `tests/acceptance/holdout/`.
   Record each result in the run report's Checks run.
7. One commit, explicit paths: code, tests, evidence; STATE (row status and
   evidence, `active_milestone`, `as_of` = the sha the checks ran against, the
   previous row's Commit cell — a commit cannot name itself); the run report's
   Plan refresh, Checks run, Acceptance, Assumptions; the plan if the refresh
   edited it; `findings.md` if promoted. The subject is the history line:
   `<M> PASS: <result in a few words>` (or `OPEN_GATE`, `BLOCKED(<type>)`).
8. Start `slice-reviewer` on the new SHA in a fresh context — in the
   background where the runtime allows it (a background subagent, not a fork;
   or the other runtime as a separate process), otherwise before the next
   milestone. One review at a time; if one is running, the next covers both
   milestones.
9. Next milestone. No summary, no check-in, no pause.

An owner-judgement gate is built, committed and marked `OPEN_GATE`, never
PASS. A missing input is resolved from the repo and recorded as an
assumption; an owner decision that blocks nothing is an Open gate. Both:
continue.

## Stop conditions — only these

1. **A failed check you cannot fix** — the fix needs a path outside the
   milestone or the write scope, a contract change or a weaker check, or three
   diagnosed attempts left it red. `FAIL`. Red code is not committed; the
   report, STATE and the red diff stay uncommitted in the worktree, and the
   report says so.
2. **A blocker whose dependents block every remaining milestone** —
   `BLOCKED(<type>)`.
3. **A contract change** — an accepted ADR, frozen contract or plan acceptance
   would have to change. `BLOCKED(contract-change)`.
4. **The plan's own stop** — the scope ends there.

## End

1. Wait for the running review and promote it; fix its in-scope CRITICAL and
   IMPORTANT findings in one commit with STATE; unreviewed fixes are Open
   gates. If the scope reached the plan's end, run the `AGENTS.md` Final
   gates, the held-out verification among them
   (`node <scenario-author skill folder>/scripts/verify-holdout.mjs`); its
   first-try pass rate goes in the run report.
2. Run `/closeout`. It finishes the report — `status` `DONE` (every milestone
   in scope PASS or OPEN_GATE), `BLOCKED(<type>)` or `FAIL`; Cost from the
   runtime's own numbers and the ledger, else `unknown`; Open gates in STATE
   only — resets `active_run: none` and commits only the run's paths. Nothing
   is pushed or merged; the worktree stays for the owner. The final message,
   in the owner's language, comes from the run report and STATE.

## RESUME

`active_run` set and its report missing or without `status`: the run was
interrupted. In its worktree, read `git log` and the diff since the last
commit, rerun the full offline gate, correct STATE to what is actually true,
then finish under the launch prompt's rules or close the report `ABANDONED`.
Prompt:
`Continue the interrupted unattended run in <worktree path>. Use the unattended-run skill, phase RESUME. Do not ask questions.`
