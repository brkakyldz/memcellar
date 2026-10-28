---
id: 0062
title: Optional skill packs live in .agents/packs/ and are linked at user level; held-out scenarios are locked by a manifest
date: 2026-10-28
status: accepted
related: [0044, 0045, 0052, 0055, 0056, 0061]
---

# 0062 — Skill packs live in `.agents/packs/`

## Context

ADR 0061 adds four optional skill packs to v2 — `research`, `build`,
`release`, `ideas` — generalized from the skill kit the reference instance
uses in every kind of project, and installed only on request. Three things
had to be decided before they could ship:

1. **Where the pack sources live in the repo.** `.agents/skills/` is loaded
   natively by Codex and, through the `.claude/skills` link, by Claude Code
   in every vault session (ADR 0044). A pack skill there would load in the
   vault whether or not the owner asked for the pack.
2. **How a pack reaches a project.** Pack skills work in project repos —
   research, the build chain, releases — and the vault is walled off from
   projects (ADR 0052). `--link-global-skills` already solves the same
   problem for `/closeout` and `/lesson`: one user-level link per skill per
   runtime, created on request, reversible.
3. **What enforces the build chain's gates.** In the reference instance the
   build skills lean on runtime hooks — a commit gate, a test gate, a run
   fence and a hook that refuses agent writes to the held-out scenarios.
   The template has never shipped hooks for project repos
   (`docs/ARCHITECTURE.md` § 10), and machinery is added only when a failure
   demands it.

## Decision

1. **Pack sources live in `.agents/packs/<pack>/<skill>/`**, one folder per
   pack. The folder sits inside `.agents/`, so the vault's top level and its
   folder-map check do not change, and nothing in it loads on its own.
2. **`node install.mjs --pack <name>` links each skill of a pack into the
   user-level skills folder of every installed runtime** (the same folders
   and rules as `--link-global-skills`); `--unpack <name>` removes exactly
   those links; `--list-packs` shows every pack and where each skill is
   linked. Packs are discovered from the folder, not listed in code. A
   linked pack skill loads in every project and in the vault.
3. **One source per skill: the template.** A link that already exists and
   points elsewhere — the owner's own kit, say — or a real folder is
   reported and left alone; only a broken link is replaced. A user with
   their own kit links to the template's copy, never copies it.
4. **A pack skill is written for any user** (ADR 0061 §3) and names only
   skills that ship: the default set, its own pack, or another pack
   conditionally ("if the research pack is installed…"). A test greps every
   pack for owner names, machine paths, model names and the reference
   instance's private files.
5. **The build pack ships no hooks.** A gate is a check the agent runs and
   records in the run report: the full offline gate before each milestone
   commit, STATE in the commit (closeout's freshness rule), the run's write
   scope against `git diff --name-only`. A user may add an enforcing hook
   for any of them.
6. **Held-out scenarios are locked by a manifest, not a hook.**
   `scenario-author` lands them with `lock.mjs land`, which copies the
   author's pack into `tests/acceptance/holdout/` and writes `LOCK.json`
   (sha256 of every file, the author, the spec commit) in a commit of its
   own. `lock.mjs check`, `verify-holdout.mjs` and `slice-reviewer` refuse
   to pass a folder that differs from the lock. Only a new author round —
   a trim, a revision — rewrites it. The suite holds at most 40 scenarios,
   a removed requirement retires its scenarios in the same change, and a
   static check (`check-scenarios.mjs`) runs before landing.
7. **The `release` pack's `ship` does releases only.** The reference
   instance's publish mode — a public repo with a private sibling repo, its
   leak scan and its hook shim — stays personal; making a repo public is
   the owner's step.

## Rationale

- Inside `.agents/` the packs are machinery like the skills beside them,
  but outside the folder both runtimes load, so the default install stays
  as small as before (ADR 0061's reason for making them optional).
- Reusing the user-level link mechanism means one set of rules — never
  replace someone else's setup, reverse cleanly — for everything the
  installer puts outside the repo.
- The manifest lock gives the property the hook existed for — the builder
  cannot change the oracle unnoticed — without a hook. In the reference
  instance the hook also refused the author's own subagent, so the owner
  had to copy every batch by hand; landing through a script that copies
  byte for byte removes that step. The budget, the retirement rule and the
  static check come from the same instance, where a held-out suite with
  none of them grew from 51 to 193 scenarios in nine days, re-tested every
  validation rule end to end, and broke on every copy or design change.

## Alternatives considered

| Alternative | Why not |
|---|---|
| A new top-level `packs/` folder | Changes the folder map and the doctor's root check for what is machinery, not vault content |
| Packs inside `.agents/skills/` | Every pack skill would load in every vault session, installed or not |
| Copying pack skills into the user-level folder | Two copies drift; the reference instance retired copies for that reason (ADR 0044) |
| Shipping the reference instance's hooks with the build pack | New machinery for every user, before any of them has seen the failure; the checks work without it |
| A hook-less held-out folder with no lock at all | Nothing would show that the builder changed a scenario it had to pass |

## Consequences

- The installer gains three flags and a test file; the doctor's folder-map
  check is unchanged.
- A user who wants enforcement adds hooks themselves; the skills say where.
- A pack skill that leans on another pack degrades instead of failing when
  that pack is not linked.
- Cost to reverse: low — a pack is a folder and its links; `--unpack`
  removes them.
