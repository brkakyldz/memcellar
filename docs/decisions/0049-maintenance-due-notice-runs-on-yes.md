---
id: 0049
title: Session start says what maintenance is due; nothing runs until the owner says yes
date: 2026-10-06
status: accepted
amends: [0033, 0038]
related: [0033, 0038, 0048]
---

# 0049 — The maintenance-due notice runs on yes

Generalized from the reference instance's record of the same number: the
reasoning is kept, the names and figures of its projects are not.

## Context

ADR 0033 retired scheduled maintenance: the trigger became the owner opening
a session. ADR 0038 then removed the session-start due line too, reasoning
that a reminder to run a pass is not a finding. With both gone, the passes
stopped running. A month later the reference instance held about 150 logs
past their 30-day distillation age, the last `/curator` and `/audit` runs were
more than two weeks old, and `.claude/hooks/checks.mjs` had no caller at all
since the git-writing hooks that used to run it were retired (ADR 0042, 0044)
— no compiled check had fired since.

The owner's request was plain: warn me when it is time, run it when I say
yes, never on its own.

## Decision

1. **Detect, announce, ask.** `maintenanceDue()` in `.claude/hooks/lib.mjs`
   computes what is due; the SessionStart hook shows it once a day as a
   "Maintenance due" section through the shared notice budget (priority 3,
   after the backup notice). The section tells the agent to mention it in one
   line and run nothing until the owner says yes.
2. **Due is judged from state where state exists.**
   - `/curator`: at least 10 logs older than 30 days still in `logs/`.
   - `/audit`: no `*_audit.md` log in 30 days, or a note past `review_by`.
   - Link sweep: no `*_link-sweep.md` log in 7 days.
   - Lessons: a topic with `routing: pending`, or two or more entries and
     `routing: none` (ADR 0048).

   Last-run dates come from the logs the passes already write, so there is no
   stamp file to maintain.
3. **On yes, the agent runs it.** `node scripts/maintenance.mjs run` does the
   deterministic half: link sweep, compiled checks over every note (the runner
   `checks.mjs` had lost), retrieval eval, brain doctor. `/curator` and
   `/audit` may be started by the agent after a yes; their descriptions forbid
   running them unasked.
4. **Nothing runs on a clock and nothing runs unasked.** ADR 0033 stands.

## Rationale

- ADR 0038 was right that a staleness reminder against a schedule nobody
  keeps is noise. This line is different in kind: it is gated on observable
  outstanding work — unprocessed logs, overdue reviews, waiting lessons — and
  it asks a question with a one-word answer.
- The budget already existed. One line a day through the shared notice budget
  cannot flood anything, and the backup notice still outranks it.
- Running the checks only on a yes is the smallest way to give `checks.mjs` a
  caller again without putting a writer back into every session start.

## Consequences

- Most vault sessions open with a one-line maintenance question until the
  backlog is cleared; after that it appears only when work is really waiting.
- A notice is recorded as shown only once it is in the delivered payload, so
  a notice dropped for size is offered again by a later session that day.
- Cost to reverse: low. Remove the notice from the hook; the script stands
  alone.
