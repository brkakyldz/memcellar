---
name: repo-bootstrap
description: "Use only at a repository lifecycle boundary — SEED before research in a new or empty repo, FINALIZE after accepted research, decisions and an implementation plan, or an explicit REPAIR of missing agent context or execution layer. Triggers: \"bootstrap this repo\", \"seed the repo\", \"finalize the repo before we build\", \"set up the execution layer\", or the same request in the owner's language. Do not use for ordinary feature work or merely because a new session began."
---

# Agent-readable repository bootstrap

Make the repository easy for a fresh agent to understand, safe for several
agents to work on independently, and ready for one launch to carry its plan
to the final gates. It establishes the repository contract and implements no
product feature. Two passes on purpose: a repo holding only intent gets a
**seed**, not an asserted architecture; once research, decisions and a plan
exist, **finalize** adds the execution layer runs and reviews depend on.

## Invocation boundary

- **SEED** — a new or nearly empty repository (intent only, no source code)
  needs its minimum orientation before research. Create stable homes for
  research and decisions; invent no architecture, owners, contracts or commands.
- **FINALIZE** — research, accepted decisions and an implementation plan are
  ready to become a verified repository contract and execution layer.
- **REPAIR** — an explicit request targets missing or broken agent context,
  commands, ownership, coordination boundaries or execution layer.

Not for a feature, a bugfix, an unresearched plan or a new session. Once
finalized, run it again only when the repository contract materially changed.

## The formats have one home

The repo-side formats — `AGENTS.md` contract, `CLAUDE.md` shim,
`docs/CURRENT_STATE.md`, `docs/runs/TEMPLATE.md` — live in the Second Brain OS
checkout this pack is installed from, in `<brain>/.claude/templates/project-repo/`.
`/closeout` reads the same folder; this skill keeps no copy of its own. To find
`<brain>`: resolve this skill's folder to its real path (the user-level skills
entry is a link), which is `<brain>/.agents/packs/build/repo-bootstrap`, and
go four levels up. The folder's `README.md` covers adoption, the read-first
order, STATE freshness and interrupted runs. If the folder is missing, stop
and say so instead of re-typing the formats from memory. Reading the templates
does not touch the vault (ADR 0052): they are formats, not vault content.

The held-out README is the `scenario-author` skill's
(`templates/holdout-README.md` in that skill's folder, a sibling of this one).

## Operating rules

- Inspect before writing: tree, git state, existing `AGENTS.md` / `CLAUDE.md`,
  README, manifests, CI, tests, ADRs, research, coordination artefacts.
- Preserve existing conventions: never overwrite, rename, migrate or delete a
  file to make the preferred layout fit; document the equivalent.
- Uncommitted work belongs to the user. No reset, stash, clean, force-push,
  dependency install, remote or commit unless asked.
- No secrets, copied external text or speculative product decisions in
  context files; `.env.example` holds names only.
- One source of truth: a README points to detail, never restates intent,
  decisions, contracts, status or history (ADR 0050).
- Exact, runnable commands; one not verified here is `UNVERIFIED` with what is
  missing, never an invented green check.
- Owner input the phase needs (scope, a missing acceptance criterion, an
  ownership call) is asked at the start, all together, with selectable options
  (AskUserQuestion in Claude Code; a numbered list of options elsewhere). In a
  `software-factory` run nothing is asked: each answer becomes an assumption
  in the run report.
- Write files in the language the repo's docs are written in; talk to the
  owner in theirs.

## Phase and mode

Choose the phase before changing anything. If none is given, infer it
conservatively: intent only or no source code → SEED; a real research,
decision and plan set → FINALIZE. State the inferred phase in the report. A
second run must be idempotent. Then the mode:

- **GREENFIELD** — empty or nearly empty: SEED lays the foundation, FINALIZE
  the full contract adapted to the chosen stack.
- **ADOPT** — a working repository missing context: add only what is missing
  and record the current conventions.
- **MIGRATE** — competing instruction, research, decision, planning or status
  stores: do not reorganize; write a migration note listing them and the
  smallest safe consolidation.

Without `.git`, `git init` is allowed when the owner asked for it; never add a
remote. If the directory is not clearly the project root, stop. Whether the
repo ever becomes public is the owner's call, made by hand later; nothing here
creates a remote or changes visibility.

## SEED output

Only the stable orientation and artefact homes
(`references/repository-contract.md`):

- a minimal `AGENTS.md` with the current intent, artefact locations and
  unresolved decisions;
- a human-facing `README.md` with purpose and links, and `INTENT.md` when the
  owner has not supplied one;
- the research store when research will happen in the repo — `reports-architecture`
  if the research pack is installed, otherwise `reports/research/` with a
  two-line README saying it holds dated `YYYY-MM-DD_<slug>.md` research only;
- minimal `docs/` homes for architecture, decisions, contracts and
  coordination, using existing conventions when present;
- a `.gitignore` addition for local secrets, caches and temporary output;
- `docs/CURRENT_STATE.md` from the formats, an empty milestone table, and
  `BOOTSTRAP_SEEDED` plus what FINALIZE still needs in its Next section.

SEED never asserts an architecture, creates fake commands, assigns undecided
owners, freezes a contract or adds product files.

## Between SEED and FINALIZE: the M0 spike

Before research, every external dependency the intent names — an LLM route, a
library feature, an API — gets a 10–20 line script in a scratch folder outside
the repo that asks "does this work the way we will use it?". The answers open
`docs/plan.md` as a *Verified assumptions* table; a dependency research adds
later is spiked before the plan names it. Procedure and what FINALIZE checks:
`references/m0-spike.md`. SEED's Next section names the spike as the next step.

## FINALIZE output

FINALIZE reads the actual research, decisions and plan and completes two
layers. The **repository contract** — architecture, source-of-truth and
ownership maps, contracts, lane boundaries, integration ownership,
generated-file rules, verified command matrix — is
`references/repository-contract.md`. The **execution layer** —
`AGENTS.md`, `CLAUDE.md`, STATE and the run-report template from the formats,
plus the checks every milestone commit runs — is
`references/execution-layer.md`.

The rules most often broken:

- `AGENTS.md` stays timeless: no dated paragraphs, no status.
- Every milestone needs acceptance IDs, exit commands and one product-level
  acceptance command. FINALIZE never invents them; it proposes them to the
  owner.
- The Commands table's *Full offline gate* row holds only commands that ran
  green here, never a paid or live call. It is a check the agent runs before
  each milestone commit and records in the run report — not a hook. A user may
  add an enforcing hook for it, or for any other check here; none ships.
- The contracts name a black-box surface (endpoint, CLI, test ids, file
  format) and a testing section that marks which values are *exact* and which
  are *descriptive*. Without it `scenario-author` stops; a missing surface is
  a contract gap, not a reason to skip held-out scenarios.
- Held-out scenarios are always planned. Only the owner waives them, per repo,
  in the `AGENTS.md` Held-out row. FINALIZE writes nothing under
  `tests/acceptance/holdout/`: the folder, its README and `LOCK.json` arrive
  in `scenario-author`'s landing commit.

If the plan or decisions are not ready, record `BOOTSTRAP_INCOMPLETE` in
STATE's Next and name the missing piece. In a `software-factory` run FINALIZE
comes before any code exists: `references/execution-layer.md` § 5.

## Procedure

1. Capture root, git state, stack, conventions, current commands and open
   questions; select phase and mode and say why.
2. Build the source-of-truth and ownership maps only to the confidence the
   phase allows.
3. Add the smallest missing artefacts, additively, in the project's language
   and conventions; in FINALIZE, the execution layer.
4. FINALIZE: run every documented command that is safe to run, the smoke path,
   and the full offline gate once. SEED: check structure and links only and
   record technical commands as `UNVERIFIED`.
5. Commit only the paths this skill wrote, by name, when the owner asked for a
   commit; the FINALIZE subject is the history line:
   `Execution layer added (repo-bootstrap FINALIZE), implementation agent <runtime>`.
6. Report phase, changed and preserved paths, verified and `UNVERIFIED`
   commands, assumptions, open owner decisions and the next step. If the repo
   is not safe for unattended or parallel work, say exactly why.

## Completion bar

FINALIZE is complete only when a fresh agent can answer, from the repo:

1. What are we building, and what is deliberately out of scope?
2. Where do I look before coding, and where is status stated?
3. Which file or owner is authoritative for this decision or interface?
4. What paths may I change in my lane?
5. Which command proves my change, which proves integration, which proves a
   milestone at product level?
6. What does one launch authorize, and exactly when must a run stop?
7. When must I stop and ask for a coordination decision?

An answer that depends on unwritten knowledge leaves the repo
`BOOTSTRAP_INCOMPLETE` with the missing fact listed. SEED is complete when a
fresh agent can find the intent, the research store, the decision and
architecture homes and the facts still unknown; next is the M0 spike.

After FINALIZE: `scenario-author` lands the held-out scenarios; a sequential
plan goes to `unattended-run` (PREPARE), a feature with two or more
independently owned workstreams to `implementation-coordinator`;
`slice-reviewer` reviews each milestone commit; `/closeout` ends every
session that changed the repo.
