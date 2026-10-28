---
name: slice-reviewer
description: "Use only to review a completed milestone read-only in a fresh context — started by unattended-run after each milestone commit, or by the owner on a named commit — checking the diff since LAST_REVIEWED against the plan's acceptance and the project's silent-failure list, and appending CRITICAL / IMPORTANT / OPTIONAL findings to docs/reviews/findings.md. Triggers: \"review milestone M3\", \"review this commit against the plan\", or the same request in the owner's language. Do not use to fix code, as a timer-driven watcher, or as a generic style review."
---

# Slice reviewer

A second agent that did not write the code reads what a milestone changed and
checks it against the plan's acceptance and the project's own list of failures
a green suite does not catch. **The reviewer proposes, the runner applies.** It
never fixes: two agents editing one tree race each other, and a reviewer
without the runner's context "fixes" what is really the next step.

## Trigger and independence

At milestone completion, never on a timer. `unattended-run` starts it after
each milestone commit; the owner may start it on any commit. One review per
branch at a time; the next covers the range since `LAST_REVIEWED`. A
timer-driven reviewer in the reference instance once fell 33 commits behind and
nobody noticed; this one states its lag first and its findings land in STATE,
so it cannot go quiet.

The reviewer runs in a fresh context that did not build the code: a fresh
subagent (never a fork of the implementing session, which inherits its
framing), or — when the owner uses both runtimes — the other runtime as a
separate process (`codex exec` or `claude -p`, when installed). The brief
names the repo and the commit, nothing more: explaining the milestone hands
over the implementer's framing, which is what the reviewer must not have.

## Inputs

- **REPO** — the implementing checkout; during a run, the run worktree.
- **SHA** — the commit to review; default the tip of REPO's branch.
- **Start** — the last `LAST_REVIEWED:` line in `REPO/docs/reviews/findings.md`,
  else the run report's `base_sha`, else the merge-base with the main branch.
  Say which.

## Rules

- Write exactly one file: append to `REPO/docs/reviews/findings.md`. Never edit
  code, tests, STATE, the plan or a run report; never stage, commit, push,
  merge or reset.
- Run nothing in REPO; checks run only in the review worktree, never live or
  paid ones. Correctness and requirement gaps only, never style.

## Steps

1. **Lag first.** `N = git -C REPO rev-list --count <SHA>..<branch>`. The
   output opens with `BEHIND: <N> commits (reviewed <sha7>, tip <sha7>)`, and
   so does the findings section under its heading; if the range spans several
   milestones, the same line says so.
2. **Worktree.** `git -C REPO worktree add --detach ../<repo>-review <SHA>`, or
   check out SHA there if it exists. Read files there, not in REPO, where the
   run keeps changing them.
3. **Read.** `git log --oneline <start>..<SHA>` and `git diff <start>..<SHA>`;
   the plan's acceptance for each milestone in range; `AGENTS.md` Invariants
   and *Invariants that break silently*; STATE and the run report at SHA;
   earlier findings.
4. **Check, in this order.**
   1. Every silent-failure pattern, by name, against the diff. No list in
      `AGENTS.md`: say so on the output's second line — the review is generic
      and weaker — and record that absence as an IMPORTANT finding.
   2. Each acceptance ID in range: does a product-level test exercise it, and
      was the acceptance command actually run — a line with its result in the
      run report — or only asserted in prose? A PASS row without evidence at
      this revision is CRITICAL (false evidence). So is a milestone commit
      whose run report has no full-offline-gate line.
   3. Honesty: "not run" counted as a pass, a test double reported as live,
      status outside STATE, evidence that does not say what the report claims.
   4. Tampering. In the review worktree run the held-out lock check
      (`node <scenario-author skill folder>/scripts/lock.mjs check`, that
      folder being a sibling of this skill's): any held-out file that differs
      from `LOCK.json` outside a `holdout: …` commit is CRITICAL. So are a
      weakened or deleted assertion, a newly skipped test, and a scope
      narrower than the plan's. The plan's own diff too: a run may refresh a
      milestone's build notes, never its acceptance, so an edit to an
      acceptance or requirement line, a stop, the Verified assumptions table
      or a section other than the milestone being built is CRITICAL, and a
      plan edit with no matching Plan refresh line in the run report is
      IMPORTANT. A unit or e2e test deleted because its feature went, or
      because it duplicates another layer, is not tampering when the commit
      or run report names the test that still covers the behaviour; a
      missing name is IMPORTANT. Held-out files retired by a `holdout: …`
      commit from the author are not tampering either.
   5. Tests added in range, against the build pack's test rules
      (`references/test-discipline.md` in the `scenario-author` skill's
      folder): a sleep, fixed wait or elapsed-time assertion, a shared data
      directory, or a held-out suite past 40 scenarios is IMPORTANT. Exact
      text the contract does not mark exact, or a rule list re-tested at a
      higher layer, is OPTIONAL.
   6. Earlier CRITICAL and IMPORTANT findings: fixed, or still open?
   7. Optional re-measurement: when the product-level acceptance command is
      offline and free, run it in the review worktree after the documented
      setup. A result that disagrees with the report is CRITICAL.
5. **Append** (create the file with the header below if it is missing):

   ```markdown
   ## <sha7> <milestone ids> — YYYY-MM-DD HH:MM, range <start7>..<sha7>
   BEHIND: <N> commits (tip <sha7>)
   - <sha7>-1 CRITICAL `path/file:123` — what is wrong. Failing scenario: <input or sequence> → <wrong observable outcome>.
   - <sha7>-2 IMPORTANT `path/file:45` — … Failing scenario: …
   - <sha7>-3 OPTIONAL `path/file:67` — …
   - <earlier id> still open at <sha7>
   - OK — <what was checked and held>, when nothing was found
   LAST_REVIEWED: <sha7>
   ```

   Every finding carries its id, severity, `file:line` and a failing scenario
   concrete enough to become a test. Without a failing scenario it is an
   opinion: drop it or make it OPTIONAL. Never repeat an earlier finding.
6. **Clean up.** `git -C REPO worktree remove ../<repo>-review`, never
   `--force`; a dirty review worktree is reported, not wiped.
7. **Output.** The BEHIND line, counts per severity, every CRITICAL and
   IMPORTANT line verbatim.

New file header:

```markdown
# Review findings
<!-- append-only; written only by slice-reviewer. The implementing session promotes
     CRITICAL and IMPORTANT ids to STATE Open gates and commits this file with that
     STATE edit; a fix names the id in its commit subject. -->
```

## Severity

The scale of the project's self-review, so one word means one thing:

- **CRITICAL** — boundary, correctness or security failure, or false evidence.
- **IMPORTANT** — required behaviour or required test missing.
- **OPTIONAL** — non-blocking improvement; it gates nothing.

`unattended-run` promotes CRITICAL and IMPORTANT to STATE Open gates and fixes
them before building on their code; with no run active, `/closeout` or the
next session does. The file is committed, so reviews travel with the branch.

## Starting it by hand

```text
Use the slice-reviewer skill on <REPO absolute path> at <SHA | the branch tip>.
Read-only: append to docs/reviews/findings.md there and change nothing else.
Start your answer with the BEHIND line.
```
