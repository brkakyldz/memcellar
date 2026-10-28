# Test discipline — a suite has a budget, and asserts outcomes

The rules the build pack follows whenever it writes, changes, reviews or runs
tests: `scenario-author` when it briefs and checks the author,
`unattended-run` when it writes unit and e2e tests, `slice-reviewer` when it reviews a milestone, `repo-bootstrap` when it
writes the testing contract.

## Why

In the reference instance, repositories built through the
unattended-run chain ended up with more test code than product code; those
built without it carried about a tenth. One held-out suite went from 51 to 193
scenarios in nine days and took 23 of the browser job's 24 CI minutes on
every pull request. The causes hold in any repository:

- **Only ever added.** Each batch asked for more scenarios; no total existed,
  no step retired one, and a reviewer counted any deleted assertion as
  tampering, so nobody deleted anything.
- **One behaviour, three layers.** The author could not see the unit tests,
  so it re-tested every validation rule end to end.
- **Wording and pixels as the oracle.** The contracts spelled out every
  string and size, and the author tested what was written. Any copy or design
  change broke scenarios; one run needed five revision rounds for 17 of them.
- **Clocks.** A sub-second deadline failed under load; lists were read once,
  before they had loaded; a fixed 5 s wait could never see a 15 s poll.
- **Platforms.** One OS renders a font about 3% wider; one CI runner's temp
  path is a short 8.3 name. Both broke exact comparisons.
- **Shared state.** One data directory for the whole suite forced a single
  worker: slow and order-dependent.

## The rules

1. **One behaviour, one layer, the lowest that can observe it.** Pure logic
   and every rule of a validator, parser or limit go in unit tests. A
   held-out scenario is a user journey across the product's real surface; it
   checks one representative refusal, never each rule in turn. An e2e test
   holds only what the held-out scenarios cannot observe, and its header
   names the scenarios it defers to.
2. **A budget.** At most **40 held-out scenarios per product**. A batch that
   would pass 40 first merges or retires existing ones, through the author,
   never the builder. Unit and e2e tests have no number, but each new one must
   name a behaviour no existing test observes.
3. **Assert outcomes.** A test checks what the user or caller gets. Exact
   strings, sizes and colours are asserted only where the contract marks the
   value **exact**: file-format fields, status and error codes, security
   refusals, a sentence the owner fixed word for word. Everything else in a
   contract describes; it does not bind a test.
4. **No clocks.** No sleeps, no fixed waits, no elapsed-time assertions under
   a second. Wait on a named state with an auto-retrying assertion. A timeout
   test sets the deadline through configuration, uses a stand-in that never
   answers, and asserts the outcome, not the time. Unit code takes the clock
   as a parameter or uses fake timers.
5. **Platforms.** Paths are compared after resolving them (real path, case,
   separators, short names). Measured text and geometry get a tolerance. A
   check that holds on one system only carries that system's tag and runs
   there.
6. **Isolation.** Every test file starts its own server on its own port with
   its own data directory. A suite pinned to one worker because of shared
   state records that as debt in STATE.
7. **CI tiers.** A pull request runs typecheck, unit, build, e2e, the
   `@smoke` journeys (at most 8) and the held-out scenarios of the areas its
   changed paths touch. A push to `main` runs the whole held-out suite. The
   final milestone or a release runs `verify-holdout.mjs` (three runs). The
   path-to-area map lives in the testing contract and greps the requirement
   prefixes the scenario titles carry. Scenarios tagged `@needs-<ID>` are
   skipped until that requirement is built.
8. **Flaky means quarantined the same day.** A test that fails and then
   passes with no change gets `@quarantine`, leaves the default run and gets
   an issue with the failing log; within a week it is fixed or deleted.
   Retries stay 0: a retry hides the flake instead of fixing it.
9. **Deleting is part of the change.** A removed or changed feature takes its
   tests with it in the same change. The builder may delete a unit or e2e test
   that duplicates another layer when the commit names the test that still
   covers the behaviour — that is not tampering. Held-out deletions go
   through the author. Weakening an assertion so a failing test passes stays
   forbidden.
10. **A count is not quality.** When the product's value is an output a person
    judges (a drawing, a ranking, an answer), keep a small benchmark of 5–10
    recorded real outputs, scored with metrics the product already computes,
    and compare each change with the previous score. Recording a real output
    that costs money is a spend: approved first.
