---
id: 0050
title: One fact, one home — WORKLOG is retired and git log is the project history
date: 2026-10-11
status: accepted
amends: [0045]
related: [0045, 0052]
---

# 0050 — One fact, one home

Generalized from the reference instance's record of the same number: the
reasoning is kept, the names and figures of its projects are not.

## Context

ADR 0045 moved project execution state into the repo and split it across
`AGENTS.md`, `docs/CURRENT_STATE.md`, `docs/WORKLOG.md`, `docs/runs/` and a
short vault log. Each file had a stated purpose, but in practice the same fact
landed in most of them. The first long autonomous run in the reference
instance showed the shape:

- every WORKLOG `milestone` line restated the commit subject and the STATE
  row of the same commit;
- the run report's *Commits* section restated `git log base..head`, and its
  *Open gates* and *Next* restated STATE;
- the closeout vault log restated the run report behind a pointer;
- a second-opinion record in the plan was edited when a reviewed decision
  changed later, so it carried the decision's history too.

A review of that run counted one changed decision written into eleven files.
Each copy is one more place to forget, and a forgotten copy is a quiet
contradiction.

## Decision

Each question a project answers has exactly one home; everything else points:

| Question | Home |
|---|---|
| Where are we now? | `docs/CURRENT_STATE.md` |
| Why did we choose this? | an ADR in `docs/decisions/` |
| What happened, and when? | `git log` — the commit subject says what changed; a milestone commit says its result (`M3 PASS: …`) |
| What must every session obey? | `AGENTS.md` — the rule alone, no date, no reason |
| What did an autonomous run check? | `docs/runs/` — checks, acceptance evidence, assumptions, cost; no commit list, gates or next step |
| What did the agent learn here? | `docs/lessons/` (ADR 0052) |

Consequences in the template:

- `docs/WORKLOG.md` is retired: its format leaves
  `.claude/templates/project-repo/`, and the read-first order reads
  `git log --oneline -15` instead of the last WORKLOG lines. An existing
  WORKLOG is frozen history — not deleted, never appended to.
- The run-report template loses *Commits*, *Open gates* and *Next*.
- A review record written once is never updated; a later change goes to the
  plan text and the ADR.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep WORKLOG, forbid restating | A rule against a habit the format invites; the format itself was the duplication |
| Generate WORKLOG from `git log` | A generated copy is still a second place to read, and adds a script |
| Keep the run report's commit list for convenience | `git log base..head` is one command and is always right |

## Consequences

- Commit subjects carry more weight: they are the history now, so they say
  what changed in words a later reader understands.
- STATE freshness no longer counts WORKLOG among the files a docs-only
  commit may touch, except a frozen one in an older repo.
- Cost to reverse: low. Re-add the template and the read-first line.
