---
id: 0056
title: Three homes — the repo, the user-level kit and the vault; owner-wide lessons and cross-project traps live in the kit, harvest is retired
date: 2026-10-24
status: accepted
amends: [0048, 0052]
related: [0044, 0045, 0050, 0055]
---

# 0056 — Three homes: repo, user-level kit, vault

## Context

ADR 0052 walled projects off from the vault. In the reference instance, five
days after the wall went up, it was measured from both sides:

- **Nothing came in.** `/harvest`, the one bridge 0052 left, had never run.
  None of the twelve project cards carried a `harvested_at`. Meanwhile the
  three active repos took 139 commits, and the vault knew none of it.
- **Nothing was captured in projects.** Not one repo had a `docs/lessons/`
  file. Before the wall, the vault had collected one or two lessons a week,
  several of them from project work.
- **Nothing went out.** Projects received only the user-level instruction
  file. The knowledge they needed most still sat in the vault, out of their
  reach: machine and harness traps, front-end traps, the verification
  discipline. One of those notes said of itself that none of its traps was
  about the project that hit it.
- **Lessons could not be counted across projects.** ADR 0048 routes a lesson
  on its second entry. A behaviour corrected once in repo A and once in repo
  B was two first entries, so it never routed.

Three kinds of knowledge were sharing one bridge:

1. The owner's working rules. Every session needs these.
2. Cross-project technical knowledge. Any project may need it.
3. Project state. Only the vault's own overview sessions need this.

## Decision

1. **Each kind has its own home.**

   | Kind | Home | Loaded |
   |---|---|---|
   | Project state, decisions, project-only lessons | the repo (`docs/CURRENT_STATE.md`, `docs/decisions/`, `docs/lessons/`) | in that repo's sessions |
   | The owner's working rules | the user-level instruction file (for Claude Code, `~/.claude/CLAUDE.md` or a kit it imports) | every session |
   | Owner-wide lessons | `<kit>/lessons/lesson-<topic>.md` | on demand |
   | Cross-project technical knowledge: traps, patterns and disciplines that hold in any repository | `<kit>/reference/<topic>.md`, one trigger line each in the user-level file | on demand, when the trigger matches |
   | How to set up or repair the kit and the vault on a machine | the kit's own README or a kit playbook | on demand |
   | The owner's life, career, learning, research, cross-project decisions, current truth | the vault | in vault sessions |

   **Two tests settle the usual hard cases.**
   - *Holds in any repository?* A trap, pattern or discipline belongs in
     `<kit>/reference/` when it names nothing specific to one repository,
     and it hit, or plainly would hit, a second one. Otherwise it stays in
     the repository's own docs. If no repository owns it, it is a vault
     topic page.
   - *A rule or decision for one project only* goes in that repository: a
     rule in its `AGENTS.md`, a decision in its `docs/decisions/`. Copy rules
     for one site are an example. It is not a lesson, not a kit rule and not a
     vault decision. If the project has no repository yet, its card holds the
     rule until it does.
   - *A pattern versus a trap.* A trap, meaning a library, tool or machine
     that behaves in a way you would not expect, goes to the kit on first
     sight, because it will hit any repository using the same thing. A
     design pattern read off one repository stays in that repository's docs
     until a second repository uses it, and then it moves to the kit.

   **A working rule lives where it is enforced.** A rule the owner wants in
   every session ("never use model X", "ask at the start, with options") is
   stated once in the user-level file. Every kit skill that touches the same
   choice follows that statement. The vault's page about the owner may
   point at the rule, but never restates it. In the reference instance's
   first baseline, one of fifteen answers broke a rule for exactly this
   reason: the rule was written only in the vault, and a kit skill still
   listed the forbidden option.

   `<kit>` is the owner's user-level kit: a private repository that holds
   their global instructions and skills. An owner without one keeps these
   files in a folder next to their user-level instruction file. The kit must
   be private. Lessons quote the owner verbatim.

2. **`/lesson` decides the store at capture.** It asks one question: would
   this correction recur in a different repository? If not, the entry goes to
   the repo's `docs/lessons/`, exactly as 0052 says. If so, it goes to
   `<kit>/lessons/`, where entries from every project meet. Routing on the
   second entry targets the user-level instruction file or the kit skill that
   ran.

   The gate from ADR 0048 is unchanged: feedback on one deliverable is not a
   lesson in either store.

   The default is the kit. A repo lesson needs a reason that ties it to that
   repository's code or domain. The vault keeps a lesson only when it is
   about operating the vault itself: its notes, its passes, its own skills.
   An entry keeps the correction verbatim plus the shortest excerpt of the
   artifact that shows the mistake. It never carries a whole pasted
   deliverable.

3. **Traps grow from the work.** `/closeout` asks whether this task hit a
   trap that is not about this repository. If it did, the trap is appended
   to the matching `<kit>/reference/` file and committed in the kit, by path.

4. **`/harvest` is retired.** Of its three jobs, lessons now go to their home
   at capture and cross-project findings go to `<kit>/reference/` at
   closeout. The third job, project status, is replaced by a read-only
   `scripts/project-board.mjs`. It reads each card's repo (last commit,
   branches, the head of the state file) and prints one table. It writes
   nothing, and nothing is copied into a card.

5. **The vault reads, never writes, a project.** A vault session may inspect
   a repo read-only to answer a cross-project question. What it records in
   the vault is the cross-project conclusion ("finish A before B"), never the
   project's own detail. The wall of 0052 stands in the other direction: a
   project session neither reads nor writes the vault.

## Rationale

- The project failures were not caused by the wall. They came from the
  wall's only door being a manual pass that depended on someone remembering
  it. Each home here is written by the session that already holds the
  knowledge, at the moment it has it.
- The kit is already loaded in every session, so owner rules and traps reach
  projects without a project ever opening the vault. 0052's reason for the
  wall, irrelevant vault content presented as context, does not come back.
- Triggered pointers keep the per-session cost to one line per reference.
  The body loads only when the work matches.

## Alternatives considered

| Alternative | Why not |
|---|---|
| A read-only `/brain-ask` from projects into the vault | Possible later; with rules and traps in the kit, no measured case is left that needs it, and the growth gate wants one |
| Keep `/harvest`, add a reminder | It never ran once; a reminder for a pass nobody runs is the notice ADR 0038 removed |
| Owner-wide lessons in the vault, copied by harvest | Recreates the counting gap: the store that counts repeats would be the one projects never write to |
| Inline the traps in the user-level file | Around 80 KB in the reference instance; pointers cost one line each |

## Consequences

- The kit gains a second kind of writer. Lessons and references are
  append-only files committed by explicit path, so collisions are rare, but
  the kit no longer has a single writer.
- In the reference instance, the vault's lesson topics and its three
  trap notes move to the kit. Each moved copy is headed with its source and
  sha, and the vault originals go to `archive/`.
- `/harvest`, its card fields (`harvested_at`, `harvested_on`) and the
  `project-doctor` checks that depend on them are removed. Cards keep why,
  where and what it taught.
- The template documents the kit as optional. Its installer links `/lesson`
  and `/closeout` at user level as before.
- Cost to reverse: low. Files move back, and the board is one script.
