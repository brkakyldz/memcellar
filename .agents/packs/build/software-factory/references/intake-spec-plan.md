# Intake, spike, spec, contracts and plan — stations 1, 1a, 3, 4 and 6

## Station 1 — Intake

`INTENT.md` holds the owner's words **verbatim** (transcribed if spoken; cut
only filler, mark cuts `[…]`), in the language they were given in, then a
distilled version in the repo's docs language: product, users, the job they
hire it for, freedoms delegated, constraints stated, non-goals inferred
(marked "owner may overrule"). Agents never edit it after the run starts; a
later intent is a new dated section written by the owner.

The intent may hold things the owner would not want in a public file. The
factory creates no public repo, so this is the owner's call at the moment they
make the repo public, by hand.

Before leaving intake, list every clause of the owner's text that names a
thing — a count, a platform, a format, a source, a deliverable. That list is
the checklist station 3 must cover and station 11 must report against, item by
item: a narrowed item is said first, with the reason. A request that named
seven things and got six is a miss, however good the six are.

## Station 1a — Spike (M0)

Before research, spike every external dependency the intent names, following
`references/m0-spike.md` in the `repo-bootstrap` skill's folder: one 10–20
line script per LLM route, library feature and API, run from a scratch folder
outside the repo, the answers written as the *Verified assumptions* table that
opens `docs/plan.md`. A ❌ row is input to research ("find another route"),
not a stop. A paid spike runs only within the allowance the owner gave when
launching; otherwise its row is `UNTESTED — needs allowance`. A dependency
that research or a contract adds is spiked before station 6 names it. The run
report's metrics count the spike's requests and the rows that came back ❌.

## Station 3 — Spec

`docs/spec.md`:

1. **Users and the job** — one paragraph, one-line promise.
2. **Requirements** — grouped by area, each with a stable ID `<AREA>-<n>`
   (`SRC-2`, `EXP-1`). EARS where there is a trigger: "When <event>, the
   system shall <response>." One observable behaviour per ID; a requirement
   whose check you cannot name is split or reworded.
3. **Out of scope** — what v1 deliberately does not do.
4. **Acceptance** — how product-level acceptance is driven (real entry
   points, real persistence, which stand-in replaces paid or external calls).

Coverage check before moving on: every clause from the intake checklist maps
to ≥ 1 requirement ID, and every requirement traces back to the intent or to a
research recommendation (cite the report). Research-added features are marked
`(research: <report>)` so the owner can see what was not theirs.

**Ambiguity.** Spec tools mark `[NEEDS CLARIFICATION]`; a no-questions
factory resolves it instead and records the resolution: an `A-nn` line in the
run report's Assumptions (choice, rejected alternative, reason) and
`(assumption A-nn)` on the requirement. Prefer the reversible, conservative
reading: private over public, read-only over write, local over hosted, free
over paid.

## Station 4 — Contracts (feed station 5)

The scenario author sees only the spec and `docs/contracts/`. A contract must
therefore name everything a black-box test needs: endpoints and payloads,
CLI commands and exit codes, UI test ids and what they contain, file formats,
the stand-in (fixture) behaviour for paid calls, and how to start the system
on a given port with isolated data.

Each contract carries a **testing section** that marks which values are
*exact* — ids, status and error codes, file-format fields, security refusals,
wording the owner fixed — and which are *descriptive*. Only exact values are
asserted literally; the rest by outcome, a regex on key words, or a
tolerance. `scenario-author` stops without that section. Version the contract
(`@1`); changing it after station 5 re-runs station 5 for the affected IDs.

## Station 6 — Plan

`docs/plan.md` in the shape `repo-bootstrap` FINALIZE accepts
(`references/execution-layer.md` §1 in that skill's folder):

- the *Verified assumptions* table from station 1a stays on top, with a row
  for every dependency the plan now uses; milestones cite the rows they rely
  on (`relies on V-2`);
- milestones `M1…Mn` in dependency order, each a vertical slice that runs;
- per milestone: requirement IDs delivered, acceptance IDs (`M3-A1`…) each
  with an exit command, and **one product-level acceptance command**;
- the first milestone creates the offline suite and fills the `AGENTS.md`
  *Full offline gate* row;
- live (paid) checks apart from offline ones, each with the allowance the
  owner approved (none is a valid allowance);
- the plan's own stops, and the final gates: full regression, the held-out
  verification (`verify-holdout.mjs` in the `scenario-author` skill's folder),
  fresh-checkout install, secret scan.

The plan defines; it never records results. Then run `repo-bootstrap`
FINALIZE, which writes the execution layer around it.
