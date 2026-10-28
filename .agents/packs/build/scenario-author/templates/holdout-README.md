# Held-out acceptance scenarios

The files in this folder were written by someone who has not seen the code:
an author outside the builder's context (`scenario-author`: a fresh subagent
that saw only the spec and the contracts, or the other runtime), or the
owner. Author: <runtime / subagent, date, spec commit>.

`LOCK.json` holds the sha256 of every file here. The implementing agent
runs these scenarios and reads their output, and never edits, moves or
deletes them. `lock.mjs check` reports any change, and the held-out
verification refuses to pass a broken lock. When a scenario fails, the
product changes, not the scenario.

## What goes here

Product-level journeys: each drives the system through its real entry point
(HTTP API, CLI, UI, files) against real persistence and asserts what a user
or operator would observe, plus what must not have happened. At most 40.
Exact text or sizes only where a contract marks them exact. No sleeps or
timing; waits on named states. Up to 8 journeys carry `@smoke`; a scenario
that needs an unbuilt requirement carries `@needs-<ID>` and is skipped until
it is built.

Each title carries its id and the requirement IDs it proves
(`H03 [M3-A2, M4-A1] …`), so a failure points at a milestone and a milestone
can run its own subset.

## The rule it enforces

A milestone is `PASS` only when its product-level acceptance command passed —
`<acceptance command>` — including every held-out scenario for that
milestone. Green unit tests are not acceptance, and neither is a green
integration: the merged tree still has to pass this command.

## Changing a scenario

Only the author changes it: a `scenario-author` revision or trim round,
landed with `lock.mjs land`, which rewrites `LOCK.json` in its own commit. A
scenario that looks wrong is an Open gate in `docs/CURRENT_STATE.md`
(`BLOCKED(unreliable-oracle)`, with the line and the contract clause it
contradicts), never fixed in place.
