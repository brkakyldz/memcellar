---
id: 0048
title: Lessons are one file per recurring behaviour, routed to a rule when a second correction lands
date: 2026-10-06
status: accepted
amends: [0019, 0038]
amended_by: [0052]
related: [0019, 0038, 0049]
---

# 0048 — Lessons are topic files, routed at capture

Generalized from the reference instance's record of the same number: the
reasoning is kept, the names and figures of its projects are not.

## Context

ADR 0019 built self-improvement as capture → corroborate → enforce-or-retire.
`/lesson` did the capture; a separate `/flywheel` pass counted repeats,
expired uncorroborated lessons and routed corroborated ones into a check or a
prose rule. ADR 0038 removed `/flywheel` with the rest of proposal production
and said the corroborate half would survive as human judgment. Nothing gave
that judgment a place to happen.

When the owner of the reference instance asked whether lessons were doing
anything, a count answered it. About thirty lesson notes, every one still
`seedling` and `confidence: low`; none promoted, none expired, because the
90-day expiry never had an executor. Two thirds of them were referenced from
nowhere outside the lesson files and the logs. The few that did change
something had been carried into a rule by hand. Capture volume was rising
fast, and much of it was feedback on one deliverable — five corrections in a
day about a single document — which the trigger "the owner corrects the
agent" admits every round of. And one file per correction scattered a
recurring behaviour across many names: one cluster was six files over three
weeks whose corrections pulled in opposite directions, and nobody saw the
cluster, so nobody reconciled it.

## Decision

1. **A lesson is a behaviour that will recur on a different task.** Feedback
   that applies only to the artifact in front of us is applied there and, if
   it should persist, written into that project's own rules. It does not
   become a lesson. A correction of a fact about the owner goes through the
   normal memory path instead.
2. **One file per behaviour, entries appended.** `lesson-<topic>.md` holds
   dated entries, each with the correction and its artifact verbatim. Entries
   are never edited. A new correction joins an existing topic when it is the
   same behaviour; otherwise it opens a new topic file.
3. **Two entries from different tasks trigger routing, in the session.** The
   capturing agent proposes one concrete change to the place that produced
   the mistake: the skill that ran, a project rule file, `USER.md`,
   `AGENTS.md`, or a check in `checks.mjs` when the rule is mechanical. The
   owner approves or refuses it. The result goes in the file's `## Routing`
   section and in `routing:` frontmatter (`none | pending | routed |
   refused`).
4. **A new entry on a routed topic means the rule failed.** That is the
   recurrence metric ADR 0019 asked for, visible in one file. The next
   proposal moves the rule closer to the work — into the skill that runs, or a
   check. A firmer sentence in the same place is not a fix.
5. **The pending queue has a reader.** `/curator` lists topic files with
   `routing: pending`, and the session start's maintenance line (ADR 0049)
   names them. Neither applies them.

## Rationale

- The mechanism that made lessons useful was the routing step, and it was the
  part that had been lost. Moving it into capture puts it where an agent
  already is, with the context loaded, instead of in a pass nobody runs.
- ADR 0019 kept interpretation out of the capture session because agents
  confabulate post-mortems. This still respects that: a single correction is
  never interpreted, a proposal needs two independent entries, the verbatim
  evidence sits next to the rule it produced, and the owner approves every
  routed change.
- One file per behaviour makes repeats and contradictions visible without any
  counting machinery.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Restore `/flywheel` as a separate pass | It was removed because it was not being run usefully; a pass with no clock depends on someone remembering it |
| Keep per-correction files, add an expiry script | Deletes the noise but still never routes anything |
| Write an interpreted lesson on every correction | The confabulation risk ADR 0019 documented; one data point is not a rule |
| Drop lessons, edit `USER.md` and skills directly | Loses the verbatim evidence and the recurrence signal that say whether a rule worked |

## Consequences

- Fewer captures. Iteration feedback on a deliverable stays in the project it
  belongs to.
- Routing proposals appear inside working sessions and count toward the
  three-a-day proactive budget, so a capture made mid-task proposes in one
  line and may be left `pending`.
- `INDEX.md` lists topic files instead of individual corrections.
- ADR 0052 later moved a project's lessons into the project's own repo
  (`docs/lessons/`); the mechanics here are unchanged, only the store differs.
- Cost to reverse: low. Topic files are plain notes.
