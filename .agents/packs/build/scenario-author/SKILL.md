---
name: scenario-author
description: Writes a product's held-out acceptance scenarios with an author outside the builder's context — a fresh subagent that never saw the code, or the other runtime when the owner uses both — from the spec and contracts alone, checks them statically, and lands them under a hash lock (LOCK.json) that later verification refuses to run past if anything changed. Also runs the trim round when the suite would pass its budget of 40 or a requirement is removed, and the revision round for a scenario reported as a wrong oracle. Use after repo-bootstrap FINALIZE and before the first milestone with a product-level surface, as the software factory's scenarios station, when unattended-run PREPARE finds none, or when the owner asks for independent acceptance tests — or the same request in their language. Not for unit tests, and never run by the agent that builds the product as the author.
---

# Scenario author

Tests written by whoever wrote the code inherit its faults: independently
written tests caught 25% of injected faults against 14% for tests written
after the code ([arXiv 2607.05139](https://arxiv.org/abs/2607.05139)). The
author is independent because of what it has **not seen** — no code (its
pack holds only the spec and the contracts) and no builder conversation (it
starts fresh, from the brief alone). A different model adds little; the pack
and the brief are what make it independent.

The reference instance also showed how such a suite goes wrong. Without a
budget it grew from 51 to 193 scenarios in nine days and ate 23 of 24 CI
minutes; it re-tested every validator rule end to end; it asserted exact
wording and pixels, so one design change broke dozens; seventeen scenarios
contradicted their own contracts and each needed a round trip; fixed waits
and one-shot reads made it flaky; scenarios for unbuilt features burned CI
on timeouts. Every rule below answers one of those. The full rule set is
`references/test-discipline.md`.

`<skill-dir>` below is the folder this SKILL.md was loaded from.

## When it runs

- **Factory:** the scenarios station — the whole spec, before any product
  code.
- **Ordinary plan:** after FINALIZE, before the first milestone in scope
  with a product-level surface; `unattended-run` PREPARE runs it when the
  milestones it is about to launch have none.
- **Trim round:** a new batch would pass the budget, or a requirement was
  removed or changed — in the same change that removes it.
- **Revision round:** a builder reported `BLOCKED(unreliable-oracle)` for a
  scenario, with the line and the contract clause it contradicts.
- **Waiver:** only the owner waives held-out scenarios, for a repo with no
  black-box surface worth testing; the waiver is the Held-out row of the
  repo's `AGENTS.md`.

## Preconditions — stop and name the gap if one is missing

- A requirement source with stable IDs: `docs/spec.md` in a factory run;
  otherwise the intent document plus the plan's acceptance IDs and their
  wording (acceptance sections only, never implementation steps).
- `docs/contracts/` naming every black-box surface: endpoints, UI test ids,
  CLI commands, file formats, fixture behaviour, how to start the system on
  its own port with its own data directory.
- **A testing contract that says what is exact.** It marks which values are
  *exact* (ids, status and error codes, file-format fields, security
  refusals, wording the owner fixed word for word) and which are
  *descriptive*. Without it the author tests every string it reads — the
  single biggest source of broken scenarios in the reference instance. A
  missing section is a contract gap: fix the contract first.
- The harness is decided (an ADR or the contract: e.g. Playwright Test and
  its config shape). The author writes tests, not a framework choice.
- The **built list**: which requirement IDs are built now, so scenarios that
  need unbuilt ones are tagged `@needs-<ID>` and skipped until then.

## Steps

1. **Pack.** An empty folder outside the repo (the runtime's scratch or temp
   directory), e.g. `<scratch>/<date>_<repo>-scenarios/`. Copy in the
   requirement source, `docs/contracts/`, the built list, and an **index of
   existing test names** — names only, no code (`grep` the test titles of the
   unit and e2e suites) — so the author does not re-test at the top what a
   unit test already holds. Nothing else: no `src/`, no test code, no git. A
   trim or revision round also copies the current `tests/acceptance/holdout/`
   — the author's own earlier work, not product code. A later batch continues
   the `H` numbering.
2. **Brief.** Fill `references/brief.md` into `BRIEF.md` in the pack: the
   main brief for a first batch or a new one, the trim brief when the batch
   would pass 40 (the budget left is 40 minus the scenarios already landed)
   or requirements were removed, the revision brief for named ids.
3. **Run the author outside the builder's context**, writes confined to the
   pack:
   - **Default:** a fresh subagent on the capable tier — never a fork of the
     building session, which inherits its framing. Its prompt is `BRIEF.md`
     verbatim plus one line: "Work only in <pack>: read nothing outside it,
     write only there." Add nothing about the code, the build or earlier
     failures. Several batches may run as parallel subagents, each with its
     own pack.
   - **The other runtime**, when the owner uses both and it is installed:
     from Claude Code, `codex exec -C <pack> - < <pack>/BRIEF.md`; from Codex,
     `claude -p "$(cat BRIEF.md)"` with the pack as working directory. Check
     the CLI's current flags for a writable sandbox first. It takes minutes:
     run it in the background and wait for the process.
4. **Check before landing.**
   `node <skill-dir>/scripts/check-scenarios.mjs <pack>/holdout` must exit 0:
   budget, ids that match their titles and `verify.json`, no sleeps or fixed
   waits, no import from outside the held-out folder, retries 0, at most 8
   `@smoke`, `COVERAGE.md` present, the report path outside the held-out
   folder. Then read every file for what a script cannot see, and reject the
   batch (re-brief once, with the exact findings) if a scenario:
   asserts something literally that the contract marks descriptive; walks a
   list of rules one by one; reads a list once before the state that says it
   has loaded; uses a fixture that breaks the contract's own limits (a label
   longer than the cap, a folder the fixture never creates); bundles a built
   journey with an unbuilt one instead of tagging `@needs-<ID>`; mocks the
   system under test; or leaves a built requirement area untested. **Never
   fix a scenario yourself** — the builder's hand on the oracle is what this
   skill exists to prevent.
5. **Land.**
   `node <skill-dir>/scripts/lock.mjs land --pack <pack>/holdout --author "<runtime / subagent, capable tier, date>" --spec <sha>`
   makes `tests/acceptance/holdout/` an exact copy of the pack — files the
   pack no longer has are removed, which is how a trim retires them — and
   writes `LOCK.json` with the sha256 of every file. The script does the
   copy, so nothing is edited on the way in. Add `README.md` from
   `templates/holdout-README.md` to the pack before landing if the author did
   not write one. Commit the folder **on its own**:
   `holdout: <n> scenarios by <author> from spec@<sha>`.
6. **Record** in the run report (or the session's summary): the count, the
   author, the requirement coverage table (ID → scenarios), anything
   rejected, and for a trim the `RETIRED.md` list.

## After landing

- The builder may **read** the scenarios to learn the journeys, never edit,
  move or delete them. `node <skill-dir>/scripts/lock.mjs check` says whether
  anything changed; `verify-holdout.mjs`, `slice-reviewer` and the factory's
  verify station refuse to pass a broken lock. The template ships no hook
  that blocks the write itself; a user who wants one can add a pre-commit
  check that runs `lock.mjs check`.
- **Running them:** a milestone runs its own subset by requirement prefix
  (`--grep M3`, `-k M3`); a pull request runs the `@smoke` journeys and the
  areas its paths touch; `main` runs the whole suite; the final milestone or
  a release runs `node <skill-dir>/scripts/verify-holdout.mjs` (three runs,
  every expected scenario executed in every run — a run that executed nothing
  is a failure, never a pass).
- **A harness defect** (the suite cannot start at all) goes back to the
  author with the exact error, same no-code rule; its fix lands as its own
  commit before any verification run. First-try pass rate counts from the
  first run that executes the scenarios.
- **A scenario that proves wrong** is an Open gate
  `BLOCKED(unreliable-oracle)` naming the id, the line and the contract
  clause. The product is still built to the spec. Resolved by a revision
  round for that id, never in place.
- **A removed or changed requirement** takes its scenarios with it through a
  trim round in the same change. An author's deletion is not tampering; the
  builder weakening a held-out assertion is.
