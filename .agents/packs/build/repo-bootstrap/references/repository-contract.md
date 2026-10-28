# Repository contract

Loaded by `repo-bootstrap` in SEED and FINALIZE. Create or complete these
artefacts only when they are absent or clearly incomplete. Adapt names to an
existing equivalent and record the mapping in the root instructions. In SEED,
create only their homes and orientation; in FINALIZE, fill them with verified
project-specific facts. The execution layer FINALIZE adds on top is
`execution-layer.md`.

## 1. Root orientation

`AGENTS.md` is the compact operational constitution for coding agents. It holds
concrete project facts, not generic advice:

- purpose, current scope and explicit non-goals;
- the source-of-truth map;
- a short tree with ownership of meaningful directories;
- domain glossary, when the project has one;
- setup, test, typecheck, lint, format, build and focused-check commands;
- environment and service prerequisites, with no secret values;
- generated files, ignored directories and files agents must not edit;
- contract boundaries, integration seams and ownership of shared files;
- the implementation lifecycle: context → plan → contract → isolated work →
  integration → verification;
- stop conditions: missing context, contract drift, destructive migration,
  security or credential uncertainty, a change outside the stated scope.

Keep it short enough to load every session; detail goes in `docs/` and is
linked. In FINALIZE the skeleton is `AGENTS.template.md` from the formats
folder (`SKILL.md` § The formats have one home), which already carries these
slots plus the execution sections.

`README.md` is the human-facing orientation: what the project does, how to run
it locally, the shortest useful architecture explanation, and links to
`AGENTS.md`, architecture, research, decisions and contracts.
Not a second task plan, and no status line — status lives only in
`docs/CURRENT_STATE.md`.

If `INTENT.md` is missing in a greenfield project, create a concise starter:
purpose, users, problem, desired outcome, constraints, non-goals. Mark
unresolved owner decisions clearly; never present a template as accepted
intent.

## 2. Durable context stores

Use these locations unless the repo already has an equivalent:

```text
docs/
  architecture.md       # system model, boundaries and important flows
  decisions/            # expensive-to-reverse choices as ADRs (adr skill)
  contracts/            # versioned cross-boundary interfaces and fixtures
  CURRENT_STATE.md      # the only file that states status (execution layer)
  runs/                 # one report per autonomous run (execution layer)
  reviews/findings.md   # slice-reviewer output, append-only (execution layer)
  evidence/             # check output and the live spend ledger (execution layer)
  lessons/              # corrections tied to this repo (/lesson)
reports/
  research/             # immutable YYYY-MM-DD_<slug>.md research reports
```

`reports/` holds dated, source-linked research only — not a backlog,
transcript, session log or personal memory. Scaffold it with
`reports-architecture` when the research pack is installed.

Architecture explains the current system. A decision record explains why an
expensive choice was made. Contracts define what each side of a boundary
may rely on. STATE says
where the work stands. A fact belongs in one of these; the others link to it.

## 3. Machine-readable project map

`AGENTS.md` carries a compact ownership table:

| Concern | Canonical location | Writer | How to verify |
|---|---|---|---|
| Product intent | actual path | owner/role | acceptance command or scenario |
| Research | actual reports path | research workflow | report check |
| Architecture | actual path | project owner | focused test or review |
| Cross-boundary contract | actual path | named owner | contract/fixture test |
| Implementation | actual source paths | owner/role | focused command |

FINALIZE adds the execution-layer rows from `AGENTS.template.md` (status,
history, runs, findings, evidence, held-out acceptance). Fill it from the
repository, not from assumptions. Every meaningful source directory has one
owner, every shared or generated file one writer. Ownership that is genuinely
undecided is marked `OPEN` and reported, never left as an invisible
assumption.

## 4. Verification surface

Derive commands from the actual stack. It must be possible to run the
smallest relevant check and the complete suite without rediscovering the
toolchain:

```text
focused unit / component check: <verified command>
contract or schema check:       <verified command>
integration / acceptance check: <verified command>
type / static check:            <verified command>
lint / format check:            <verified command>
full suite:                     <verified command>
```

Separate API, frontend and other checks when the repository supports it.
Do not claim a check is independent unless it was shown to run independently.
Add a minimal smoke test only when the repo has no reliable way to prove that
the documented setup works; scaffolding does not manufacture coverage.

A command that could not be run here is written `UNVERIFIED` with what is
missing, and never goes into the *Full offline gate* row.
