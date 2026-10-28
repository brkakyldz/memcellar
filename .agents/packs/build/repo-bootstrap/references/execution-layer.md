# Execution layer — what FINALIZE adds

Loaded by `repo-bootstrap` in FINALIZE, and in a REPAIR that adds the layer to
an older repo. The file shapes come from the formats folder,
`<brain>/.claude/templates/project-repo/` (`SKILL.md` § The formats have one
home); `unattended-run`, `slice-reviewer` and `/closeout` read the same files
once they are in the repo.

The layer is what lets one launch carry a plan from its first milestone to its
final gates, and what lets the result outlive the session: rules in
`AGENTS.md`, one living state file, commit subjects that read as history, one
report per run, and a fixed set of checks every milestone commit runs and
records. In the reference instance one project ran eight milestones and its
final gates unattended in about six hours on these files; everything
project-specific is a slot, never a default.

## 1. What the plan must already give

The layer is only as good as the plan's acceptance. Confirm the plan has:

- a *Verified assumptions* table at the top, with a tested row for every
  external dependency the plan uses (`m0-spike.md` § What FINALIZE checks);
- milestones with stable IDs, in dependency order;
- per milestone: acceptance IDs, each with an exit command or explicitly
  marked as an owner judgement, and one **product-level acceptance command** —
  the real entry point against real persistence, not a component test;
- live checks kept apart from offline ones, each with an allowance per bucket
  that the owner approved, with its cost;
- the stops the plan itself names (a diagnostic milestone, "the last cheap
  point to change X"), which an unattended run will honour;
- final gates, including the held-out verification
  (`scripts/verify-holdout.mjs` in the `scenario-author` skill's folder) over
  the scenarios `scenario-author` lands;
- acceptance IDs worded so someone who never sees the code can test them —
  they are the held-out author's only requirement source besides the intent.

The plan defines; it never records results — no "Status:" line, no ticked
checklist. The one exception is the Verified assumptions table: pre-plan facts
the plan is built on, not progress through it. A missing piece leaves the repo
`BOOTSTRAP_INCOMPLETE`, naming the milestone and the gap. FINALIZE does not
invent acceptance criteria; it proposes them to the owner.

Only the plan's acceptance is fixed: requirement and acceptance IDs, what each
asserts, the product-level command, the stops. The rest of a milestone section
is build notes, which `unattended-run` refreshes against the code just before
that milestone is built, so the last milestone's notes are not the first
milestone's guesses. Acceptance lines carry their IDs, so the two are easy to
tell apart.

## 2. Files, in order

**`AGENTS.md`** — from `AGENTS.template.md`.

- Read-first: the real plan path. Measure the read-first set (this file,
  STATE, `git log --oneline -15`, the largest milestone section); past about
  40 KB, detail must move out.
- Ownership, commands, environment, invariants: from the repository, the
  architecture and the ADRs. Only verified commands.
- *Invariants that break silently*: from the research, ADR consequences and
  incidents in git history, each with the scenario that exposes it. If none is
  known yet, leave one line saying where the list will come from and add an
  Open gate to STATE — `slice-reviewer` is generic and weaker without it.
- Autonomy, blockers, status vocabulary, evidence, self-review: keep the
  template text and change only the slots. Rewording them per project is how
  two repos drift into two meanings of PASS. Drop the ledger bullet when the
  plan has no live checks.
- Held-out row: `scenario-author` (or the owner) writes, the builder never
  does. Only the owner may waive held-out scenarios for this repo, by saying
  so in that row.
- Final gates: from the plan's final section.
- An existing `AGENTS.md` gains only the missing sections. Dated owner-policy
  paragraphs or status found in it are listed in the migration note, not
  rewritten unasked.

**`CLAUDE.md`** — the shim from `CLAUDE.template.md`. If a `CLAUDE.md` with
content exists and no `AGENTS.md` does, keep the one file with content and add
the Claude-only lines there; never two copies.

**`docs/CURRENT_STATE.md`** — from the template, ≤ 80 lines.

- `project_id`: a kebab-case slug, usually the repo name.
  `implementation_agent`, `branch`, `as_of` (short sha of HEAD),
  `active_milestone: none`, `active_run: none`.
- One row per plan milestone, `PLANNED`. In ADOPT a row is `PASS` only with
  evidence at a named revision; otherwise `PLANNED` or `IN_PROGRESS`.
- Freshness is the rule in the template's comment and in `/closeout`: no
  commit after the latest commit to STATE touches anything but STATE and
  `docs/runs/`. Code and its STATE update in one milestone commit is the
  preferred shape; a docs-only follow-up is also fresh.
- No feature inventory (README), no history (git), no instructions
  (`AGENTS.md`).

**No `docs/WORKLOG.md`** (ADR 0050). The FINALIZE commit subject is the
history line. An existing WORKLOG stays as frozen history; nothing appends to
it.

**`docs/runs/TEMPLATE.md`** — copied from the formats. `unattended-run`
creates one report per run from it and adds a `## Plan refresh` section when
the template has none.

**`docs/evidence/`** — only when the plan has live checks. The live spend
ledger is `docs/evidence/live_ledger.jsonl`, committed, append-only: an
`attempt` line written *before* each live call (attempt id, bucket, allowance,
ordinal, revision with a dirty flag, configuration, start time), then a
`result` line (attempt id, outcome, end time, request count). Reserving first
means a crash mid-call still counts. Allowances come from the plan. Writing
the ledger code is a task of the first milestone with a live check, not of
bootstrap.

**`docs/reviews/`** — nothing. `slice-reviewer` creates `findings.md` on its
first review.

**`tests/acceptance/holdout/`** — nothing. `scenario-author` lands the
scenarios, the folder's README and `LOCK.json` in one `holdout: …` commit, and
the lock is a manifest (sha256 of every file), so a file FINALIZE put there
first would either be replaced or break the lock. STATE's Next names
`scenario-author` as the step before the first build milestone.

## 3. The checks, without hooks

The template ships no enforcement hooks for project repos. Each check is a
step the agent runs and writes down; a user who sees the failure one prevents
may add an enforcing hook for it.

| Check | What the agent does | Where it is recorded |
|---|---|---|
| Full offline gate | runs every command in `AGENTS.md` § Commands *Full offline gate* before each milestone commit; red is not committed | the run report's *Checks run* |
| STATE in the commit | the milestone commit carries the STATE edit; `/closeout` checks freshness | `git log` |
| Held-out lock | `node <scenario-author skill folder>/scripts/lock.mjs check` before each milestone commit and at verification; any changed, added or removed file under `tests/acceptance/holdout/` is a CRITICAL finding, and only a new `scenario-author` round rewrites `LOCK.json` | *Checks run* |
| Run fence | before each commit of an unattended run: branch is `run/<slug>`, the working directory is the run worktree, and `git diff --cached --name-only` lists nothing outside the launch prompt's write scope or under `tests/acceptance/holdout/` | *Checks run* |

Rules for the *Full offline gate* row:

- Only commands that ran green here, and never a paid or live call.
- No offline suite yet (greenfield): leave the row `UNVERIFIED`; the plan's
  first milestone creates the suite and fills the row, and says so in its
  acceptance.
- Every file a check needs is committed. A worktree holds only tracked files,
  so an untracked config silently disables that check in every run worktree.
- Run the gate once during FINALIZE and record the result in the report to
  the owner before calling the layer configured.

## 4. REPAIR of an older repo

A repo finalized before this layer existed gets it through REPAIR with the same
formats under ADOPT rules: additive only. An existing status store — a long
state file carrying history and feature inventory, "Status:" lines in plans,
ticked checklists — is a MIGRATE case: list every place that states status and
the smallest consolidation into one STATE, and change nothing until the owner
asks.

## 5. Deliberately left out

- Budgets, model choices, ports, product invariants: slots, never defaults.
- A second status file, a progress-report document, ticks in the plan, a
  worklog that restates commit subjects.
- Dated paragraphs in `AGENTS.md`. "The owner changed X on <date>" is an ADR
  when it is expensive to reverse and a commit subject otherwise; the rule it
  produced is written timelessly.
- Any read or write of the owner's vault (ADR 0052).
