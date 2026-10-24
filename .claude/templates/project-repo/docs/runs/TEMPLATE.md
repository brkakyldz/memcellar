---
type: run-report
status:
run: <slug>
runtime: claude-code
started: YYYY-MM-DD HH:MM
ended:
base_sha: <sha>
head_sha:
---
# Run report — <slug>

<!-- status: DONE | FAIL | BLOCKED(<type>) | ABANDONED — left empty until the run ends.
     runtime: claude-code | codex.
     STATE.active_run pointing here while status is empty means the run is live or was
     interrupted: re-read git log + diff, re-run the checks, correct STATE, then finish
     the run or set status ABANDONED.
     Only what git and STATE do not hold: the commits are `git log base_sha..head_sha`,
     open gates and the next action live in STATE. -->

## Checks run
<!-- exact command → result; "not run" is a line, not a silence -->

## Acceptance
<!-- product-level acceptance IDs → PASS/FAIL/not run + evidence path -->

## Assumptions

## Cost
<!-- tokens / money / live calls, from the runtime's own numbers; "unknown" if unknown -->

