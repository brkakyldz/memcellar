# Execution-layer formats (C1–C3)

The file shapes closeout reads and writes. A change to a format is a
decision, not an edit made in passing (ADR 0045). Amended by ADR 0050 (C2
retired) and ADR 0052 (C4 and C5 leave closeout).

## C1–C3 — repo side: one canonical copy

The repo formats live in `<brain>/.claude/templates/project-repo/`, and that
folder is the only copy — read it, do not re-type it here. `<brain>` is the
checkout this skill is linked from, three levels up from the skill's real
folder (`<brain>/.agents/skills/closeout`). Those are templates, not vault
content, so reading them does not cross the wall in ADR 0052; a repo that has
already adopted the formats has its own copies in `docs/`, and those are what
closeout edits. The folder's `README.md` covers adoption, the read-first order
and the interrupted-run protocol.

- C1 `docs/CURRENT_STATE.md` — the only file that states status. The status
  vocabulary, the blocker types and the freshness rule (no commit after the
  latest STATE commit touches code) are in its comments.
- C2 `docs/WORKLOG.md` — retired (ADR 0050). Its lines restated commit
  subjects and STATE rows; `git log --oneline` is the history and ADRs carry
  the why. An existing file is frozen history, never appended to.
- C3 `docs/runs/TEMPLATE.md` — one report per autonomous run, holding only
  what git and STATE do not: checks, acceptance evidence, assumptions, cost.
  `status:` stays empty while the run is live; a report without a status next
  to a set `active_run` is an interrupted run (see closeout § Interrupted
  runs).

## C4, C5 — vault side: not a project's business any more

A project session never reads or writes the vault (ADR 0052). The project
card (C4) is written only by the vault's own `/harvest` skill, which reads
the repo read-only and keeps the card format in its own folder. The closeout
vault log (C5) is retired; existing logs are append-only evidence. STATE's
`project_id` is the one link a repo keeps — `/harvest` maps it to a card.
