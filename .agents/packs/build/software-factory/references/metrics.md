# Factory sections of the run report

Append these to the run report created from `docs/runs/TEMPLATE.md` (the
formats' run-report template) for a factory run. Every number comes from a
command, a timestamp or a file; "unknown" is allowed, a guess is not.

```markdown
## Intent coverage
<!-- each clause from the intake checklist → requirement IDs → milestone → PASS/OPEN_GATE/not built -->

## Station log
| # | Station | Started | Ended | Artefact | Check |
|---|---|---|---|---|---|

## Factory metrics
- Wall-clock, intent → ship: <h:mm> (from station 0 `started` to the ship commit time)
- Owner minutes during the run: <n> (0 for a no-questions run; count any interruption)
- Held-out scenarios: <n> written by <fresh subagent | other runtime>; first-try pass <k>/<n>; after fixes <k>/<n>; verify-holdout runs <N>
- Fix rounds per milestone: <list>
- Review findings: CRITICAL <n>, IMPORTANT <n>, OPTIONAL <n>; open at ship <n>
- Product code / test code: <lines> / <lines> (`git ls-files … | xargs wc -l`)
- Spend: <tokens or money from the runtime's own numbers, or "unknown">; live calls <n> (ledger) against the approved allowance <n>
- Assumptions made instead of questions: <n> (list in Assumptions)
- M0 spike: <n> requests; verified rows ✅ <n> / ❌ <n> / untested <n>; plan rewrites caused by a late-found dependency <n>

## Owner gates
<!-- the irreversible, public, paid or taste-level steps left to the owner, each with the exact command -->
```

The summary to the owner, in their language, leads with what was built and
where, then the held-out result, then the assumptions they are most likely to
overturn, then the owner gates.
