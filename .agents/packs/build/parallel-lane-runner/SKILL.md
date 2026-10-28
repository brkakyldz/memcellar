---
name: parallel-lane-runner
description: Use only to execute one named lane from an existing coordination packet, with a frozen contract, an isolated worktree and independent checks. Triggers: "run lane <name> from the packet", "execute the API lane", or the same request in the owner's language. Do not use to decide decomposition, to start parallel work without a packet, or for ordinary single-agent implementation.
---

# Parallel lane runner

You are one implementation worker in a contract-first build. The coordination
packet is your scope. Work independently inside the lane and leave
integration to the named integrator.

This skill never decides whether work should be parallel; that belongs to
`implementation-coordinator`. If its packet is absent, contradictory or holds
only a sequential plan, return `BLOCKED`.

## Start safely

1. Read the coordination packet, the project's `AGENTS.md`, the relevant ADRs
   and only the source files named by your lane.
2. Confirm the exact base SHA and that this is an isolated worktree and
   branch.
3. Confirm the contract version, allowed paths, forbidden paths and required
   commands before editing.
4. If the packet is missing, contradictory or points to a moving interface,
   report `BLOCKED` instead of guessing across lane boundaries.

Do not inspect the whole repository unless the packet names a specific
unknown that must be resolved. Do not ask the owner about reversible local
choices; record the assumption and continue.

## Implement within the lane

- Own only the paths assigned to this lane. Do not edit another lane's files,
  the frozen contract, shared generated output, the integration branch or
  anything under `tests/acceptance/holdout/`.
- Provider (API) lane: implement provider behaviour and provider-side
  contract tests.
- Consumer (frontend) lane: use the packet's mock or fixture and write
  consumer-side tests; never weaken the contract to make the UI pass.
- Evaluation lane: add independent scenarios and assertions without changing
  production behaviour to satisfy them.
- Keep changes narrow, preserve existing behaviour, skip unrelated cleanup.
- When the interface is genuinely insufficient, stop with `BLOCKED` and name
  the exact contract amendment required. No private incompatible
  interpretation.
- No paid or live call the packet does not authorize.

## Verification

Run the lane's focused checks while implementing and all required lane gates
before completion, with the packet's real commands. A green result must be
reproducible from the current worktree. Never infer success from a status
document, a comment, a previous run or an unexecuted command.

If a check fails:

- classify it: code failure, environment failure, contract mismatch or
  untrusted oracle;
- fix it only if it is inside the lane boundary;
- otherwise stop the lane and report `FAIL` or `BLOCKED`;
- never delete, weaken or bypass a failing test to manufacture green.

## Completion contract

Before committing, check `git diff --cached --name-only` against the lane's
allowed paths. Commit only lane-owned changes, by path, with a descriptive
message. Do not push, merge, deploy or delete worktrees. Return:

```text
STATUS: READY_FOR_INTEGRATION | FAIL | BLOCKED
LANE: <name>
BASE_SHA: <sha>
COMMIT_SHA: <sha or none>
CONTRACT: <name/version>
CHANGED_FILES: <exact list>
CHECKS_RUN: <commands and result>
ASSUMPTIONS: <list or none>
KNOWN_GAPS: <list or none>
INTEGRATION_NOTES: <ordering, fixtures, migration or setup notes>
```

If the packet names a lane handoff path, write the same report there. Write
no shared status file unless the packet assigns that path to this lane.

The integrator, not this worker, decides whether the combined system is green.
