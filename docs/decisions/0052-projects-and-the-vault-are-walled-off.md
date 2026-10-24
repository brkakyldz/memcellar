---
id: 0052
title: Projects and the vault are walled off — a project keeps its own lessons, the vault reads projects on request
date: 2026-10-19
status: accepted
amends: [0045, 0048]
related: [0042, 0044, 0045, 0048, 0050]
---

# 0052 — Projects and the vault are walled off

Generalized from the reference instance's record of the same number: the
reasoning is kept, the names and figures of its projects are not.

## Context

Since global mode (ADR 0008, carried into 0042 and 0044) every session on the
machine ran the vault's SessionStart hook. Outside the vault it injected
`USER.md`, the whole of `MEMORY.md` and a block of standing rules telling the
agent to write a vault log at closeout. `/recall` searched the vault from any
repo, and `/lesson` wrote every correction into the vault's `notes/`.

The problem surfaced in use: the vault holds a lot that is irrelevant to
the project at hand, and agents got confused by it. Read on the day it was
raised, almost none of the `MEMORY.md` a project session received had
anything to do with the repo being worked on, and all of it was presented as
context the agent was meant to use.

ADR 0045 had already moved execution state into the repo, and project ADRs
already lived in each repo's `docs/decisions/`. Lessons were the last project
record still written to the vault, and the injection was the only channel
pushing vault content into projects.

## Decision

1. **A project session neither reads nor writes the vault.** The SessionStart
   hook does nothing outside the vault — no pull, no injection, no log line.
   No skill or hook points a project session at a vault path.
2. **A project keeps its own lessons.** `/lesson` writes to the current repo:
   `docs/lessons/lesson-<topic>.md`, one file per behaviour, entries appended
   verbatim, routed to the project's own `AGENTS.md`, skill or check after a
   second entry (ADR 0048's mechanics, a different store). Inside the vault it
   still writes `notes/lesson-*.md`.
3. **`/closeout` never touches the vault.** The vault log and the `MEMORY.md`
   step are gone; closeout ends with the repo's own commit.
4. **The vault reads projects when the owner asks.** A vault-only
   `/harvest <project>` skill reads a repo read-only — STATE, ADRs, lessons,
   `git log` since the last harvest — and updates the project card and the
   vault's notes. It never writes into the repo. Project cards are written
   only this way.
5. **`/recall` is a vault skill.** It loads only in a vault session; the
   user-level links an installer may create cover `/closeout` and `/lesson`
   alone.
6. **What the owner wants from every session** — how to talk to them, how to
   work — belongs in whatever user-level instruction file their runtime reads,
   as the rule alone, without vault evidence links.

## Rationale

- A context block earns its place by being relevant to the work. Tier 0 is
  budgeted for the vault's own sessions; in a project it was mostly noise
  that the agent treated as signal.
- Each repo now has one writer — its own sessions. Much of the vault's
  concurrency machinery existed because many project sessions committed into
  one vault.
- A harvested lesson entry can be copied without drift: project lesson
  entries are append-only and never edited, so a copy with a `source:`
  pointer stays true.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Inject a trimmed `MEMORY.md` into projects | Still decides for the project what is relevant; the trim rots like any filter |
| Projects write lessons to the vault but never read it | Lessons are then unreadable by the project that learned them, so the same correction repeats there |
| Hard-block vault paths with a permission deny rule | Would also block the vault's own sessions; with nothing pointing projects at the vault, the block buys little |

## Consequences

- Project sessions start with only the user-level instructions and the repo's
  own files. The communication style in `USER.md` no longer reaches them; if
  that shows, its lines move into the user-level instructions.
- The vault falls behind a project until the owner runs `/harvest`. No
  reminder is built — the growth gate wants a real failure first.
- Global mode's wiring becomes harmless rather than wrong: a user-level hook
  still fires in every session, and exits at once outside the vault.
- Cost to reverse: low. Re-enable the hook branch and point the two skills
  back.
