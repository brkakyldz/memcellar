---
name: integration-gate
description: Use only after a coordination packet has produced two or more completed parallel-lane reports — integrates them in a single-writer worktree and verifies the combined result. Triggers: "integrate the lanes", "merge the parallel work and verify it", or the same request in the owner's language. Do not use after ordinary single-agent work, for decomposition, or as a generic final review.
---

# Integration gate

You are the single-writer integration and verification seat. Start from the
coordination packet's base SHA in a dedicated integration worktree. The lane
branches and their completion reports are inputs, not proof.

This is the final gate for a parallel execution branch. With no coordination
packet, fewer than two lane reports, or no isolated integration worktree,
return `BLOCKED` and keep the work in its sequential flow.

Do not push, deploy, force-reset, delete branches or rewrite history. Do not
silently edit both sides of a contract mismatch. You may edit integration glue
and files the packet assigns to the integration lane; semantic changes go back
to the owning lane.

## Preflight

1. Read the coordination packet, the project's `AGENTS.md`, relevant ADRs and
   every lane report.
2. Confirm each lane is based on the declared base SHA and stayed inside its
   ownership boundary.
3. Confirm no lane reports `FAIL` or `BLOCKED`.
4. Inspect each branch's changed-file list and reject overlap with another
   lane unless the packet named the file as single-writer integration scope.
   A change under `tests/acceptance/holdout/` from any lane is a rejection.
5. Check that contract and fixture versions match across all lanes.

If preflight fails, return `BLOCKED` with the exact evidence. Never merge a
branch because its prose says it is complete.

## Integrate in order

Merge or cherry-pick lanes in the packet's declared order. After each merge:

1. run contract and schema checks;
2. run focused tests for the affected seam;
3. inspect the diff for scope drift and accidental generated changes.

Then run the full applicable suite: the `AGENTS.md` full offline gate, type
and lint checks, provider and consumer contract tests, the held-out lock check
(`node <scenario-author skill folder>/scripts/lock.mjs check`, where that
folder is a sibling of this skill's), the held-out scenarios, end-to-end tests
and the project's real acceptance command. For semantic gaps no deterministic
check covers, use a reviewer in a fresh context that did not build the code —
a fresh subagent, not a fork — told to report correctness gaps, not style.

## Handle mismatch explicitly

When provider and consumer disagree, report the smallest mismatch with
contract version, a request/response or event example, the owning lane and the
recommended fix. Return `REWORK_REQUIRED` and send the correction to that
owner. Never patch both sides into a new undocumented agreement on the
integration branch.

A purely mechanical conflict in a file the packet assigns to the integration
lane: resolve it, test it, record the resolution. A conflict that changes
domain semantics, authority, persistence, security or the contract: return
`BLOCKED` for a decision or a new coordination revision.

## Final report

```text
STATUS: INTEGRATION_GREEN | REWORK_REQUIRED | BLOCKED
BASE_SHA: <sha>
INTEGRATED_COMMITS: <lane/sha list>
CONTRACT_CHECKS: <commands and result>
FULL_CHECKS: <commands and result>
ACCEPTANCE: <scenario results>
SCOPE_DRIFT: <none or exact paths>
REWORK: <owner, mismatch and next action, or none>
OPEN_HUMAN_GATES: <visual, taste or architecture decisions, or none>
EVIDENCE: <paths to reports, logs or screenshots>
```

`INTEGRATION_GREEN` means the combined artefact passed the executable gates.
It is an input to a milestone's PASS, not a PASS: the merged tree still has to
pass the milestone's product-level acceptance command, and subjective owner
review stays open. A check that did not run is an open gate. Never convert a
warning, a reviewer's opinion or an intended future check into a pass.
