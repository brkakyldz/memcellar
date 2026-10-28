---
name: software-factory
description: Turns one owner intent into a built, verified and (optionally) released product with no questions asked — intake, spike, research, spec, contracts, independent held-out scenarios, plan, build, verify, review, ship and a metrics report — by chaining the build pack's skills. Use when the owner gives only the idea and says "run it through the software factory", "take my intent and finish it", "don't ask me, build the project", "write the spec and the tests yourself", or the same request in the owner's language. Not for a single feature in a finalized repo (unattended-run) or for planning only.
---

# Software factory

The owner writes intent; the factory produces everything else and leaves a
trail a stranger can audit. The value is not that agents write the code — it
is that **every claim of "done" is a measurement the builder could not game**,
and every guess the factory made instead of asking is written down where the
owner can overturn it. Why each station exists, with sources:
`references/stations.md`.

The factory is **lit**, not dark: the owner is not asked during the run, but
the run never takes an irreversible, public or paid step on its own —
making a repo public, merging into someone else's branch, deleting, a deploy,
or any spend the owner did not approve, with its cost, when launching. Each
of those ends as an Open gate with the exact command to run.

`<skill-dir>` is the folder this SKILL.md was loaded from. The sibling skills
of this pack (`scenario-author`, `repo-bootstrap`, …) sit next to it; their
scripts are run as `node <skill-dir>/../<skill>/scripts/<x>.mjs`.

## Stations, in order

Each station has an artefact; it is done when the artefact exists and its
check ran. Never skip forward: a station that cannot finish records why in the
run report, and the run stops there.

| # | Station | Artefact | Done when |
|---|---|---|---|
| 0 | Open the run | `repo-bootstrap` SEED if the repo is empty; `docs/runs/<date>_factory-<slug>.md` from the run-report template in the formats folder (`repo-bootstrap` § The formats have one home) + the factory sections (`references/metrics.md`) | file exists, `started` set |
| 1 | Intake | `INTENT.md` — the owner's words verbatim + a distilled version + inferred non-goals | owner text quoted, nothing paraphrased into it |
| 1a | Spike (M0) | *Verified assumptions* table opening `docs/plan.md`; scripts in a scratch folder outside the repo (`repo-bootstrap` `references/m0-spike.md`) | every dependency the intent names has a tested row |
| 2 | Research | `reports/research/<date>_*.md` — via `research` if the research pack is installed; otherwise do the searches directly and write the same report shape (question, sources inline with dates, conclusions, prior work named or "none found") | every recommendation sourced |
| 3 | Spec | `docs/spec.md` — requirements with stable IDs, EARS wording, out-of-scope list | every intake clause maps to ≥ 1 ID (`references/intake-spec-plan.md`) |
| 4 | Decisions + contracts | ADRs (`adr`), `docs/contracts/*` — the black-box surface the scenarios may rely on, with a testing section marking *exact* vs *descriptive* values | each expensive choice has an ADR; contracts name endpoints, test ids, file formats |
| 5 | Held-out scenarios | `tests/acceptance/holdout/*` + `LOCK.json` via `scenario-author` — an author **outside** the builder's context, from spec + contracts only | landed and locked **before product code exists** |
| 6 | Plan | `docs/plan.md` — milestones with acceptance IDs, exit commands, one product-level acceptance command each | `repo-bootstrap` FINALIZE accepts it |
| 7 | Build | milestone commits through the `unattended-run` loop (in-session is allowed: the owner launched the factory) | each milestone PASS with its evidence line, full offline gate green and recorded |
| 8 | Verify | `node <skill-dir>/../scenario-author/scripts/verify-holdout.mjs` — lock check, then held-out N×, executed-count proof | `VERIFIED` line in the run report; red → fix the product, never the scenario |
| 9 | Review | `slice-reviewer` on the final range, in a fresh context that did not build the code | no open CRITICAL / IMPORTANT |
| 10 | Ship | `ship` if the release pack is installed — README, LICENSE, CHANGELOG, CI, a **private** GitHub repo, tag; otherwise the release steps stay an Open gate with the commands | CI green on the pushed commit, or the reason it is not |
| 11 | Report | run report factory sections + `/closeout` | metrics filled from measurements; summary to the owner in their language |

## The rules that make it a factory

1. **No questions, but no silent guesses.** Every place you would have asked
   becomes a line under the run report's *Assumptions* with the alternative
   you rejected (`A-03: canvas library = X, not Y — licence`). The spec marks
   the requirement it shaped with `(assumption A-03)`.
2. **The scenario author is not the builder.** No conversation, no access to
   the code. Scenarios land under the lock before station 7; the builder may
   read them but never edit them, and the lock check runs before every
   milestone commit. When one looks wrong, it becomes an Open gate
   `BLOCKED(unreliable-oracle)` with the scenario id, the line and the
   contract clause it contradicts, and the product is still built to the
   spec; a `scenario-author` revision round for that id resolves it.
3. **Contracts before scenarios, scenarios before code.** The author can only
   test what a contract names. A contract change after station 5 re-runs
   station 5 for the affected IDs.
4. **A verifier proves it ran.** Zero executed tests, a missing expected
   scenario, or "no output" is a failure, never a pass.
5. **Deterministic over agent judgement at the ends.** Ship comes from a
   template and a script; the agent fills slots, it does not invent a release
   process. The owner's taste (style, naming) is research-led and recorded as
   assumptions, not asked.
6. **Measure, don't narrate.** The run report's *Factory metrics*
   (`references/metrics.md`) come from commands and timestamps: wall-clock per
   station, held-out first-try pass rate, fix rounds, review findings by
   severity, spend, lines of product vs test code.
7. **Spend only what was approved.** A spike, a live check or any paid call
   runs only within an allowance the owner gave, with its cost, when launching
   the factory. Without one, the row is `UNTESTED — needs allowance` and an
   Open gate, and the build uses the offline stand-in the contract names.

## Who plays which role

The session the owner launched conducts and builds. Two roles must not be
played by it: the held-out author (station 5) and the final reviewer
(station 9). Each runs in a fresh context that has not seen the build — a
fresh subagent on the capable tier, never a fork of the building session,
which inherits its framing — briefed only with what its station allows. When
the owner uses both runtimes, the other runtime may take either role as a
separate process (`codex exec` or `claude -p`, when installed); the
independence comes from what the context has not seen, and a second vendor's
blind spots are a bonus. Started from either runtime, the same split applies.

## Files

- `references/intake-spec-plan.md` — stations 1, 1a, 3, 4 and 6: how intent
  becomes IDs, the assumption ledger, the plan shape FINALIZE accepts.
- `references/stations.md` — the research behind each station, with sources.
- `references/metrics.md` — the run report's factory sections.
- Sister skills: `repo-bootstrap`, `adr`, `scenario-author`, `unattended-run`,
  `slice-reviewer` (this pack); `research` (research pack) and `ship`
  (release pack), each optional; `/closeout` (always installed).
