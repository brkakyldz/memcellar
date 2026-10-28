---
id: 0063
title: The template is renamed memcellar, and v2.0 is its first release under that name
date: 2026-10-28
status: accepted
amends: [0061]
related: [0006, 0046, 0061]
---

# 0063 — Renamed to memcellar

## Context

"Second Brain OS" said the wrong two things. "Second brain" is a crowded
term — a book, a method and hundreds of note-taking templates — and it names
a personal knowledge system for a human, while this template is a memory for
coding agents. "OS" promised something that runs; the template runs nothing
of its own and sells exactly that. The repository had no stars or forks yet,
so a rename cost almost nothing.

Names were checked on GitHub and npm on 2026-10-28. `memvault`, the first
choice, was taken by at least fifteen repositories, several of them agent
memory projects, and by an npm package. `memcellar` had no repository and no
package.

## Decision

1. **The template is called memcellar** — a cellar is a vault where things
   are kept and age, as pages here mature from seedling to evergreen. The
   GitHub repository is renamed `brkakyldz/memcellar`; GitHub redirects the
   old address.
2. **The version keeps counting.** The release ADR 0061 describes ships as
   `v2.0`. The existing `v1.0` and `v1.1` tags stay as they are, so the
   upgrade path from v1.1 stays one step and no published tag changes
   meaning.
3. **The name changes where it names the product:** the README, the
   session-start header, `install.mjs`, `SETUP.md`, `LICENSE`, the pack
   skills that recognise a vault, and the figures. "Second brain" as a plain
   description of what a vault is for may stay in `AGENTS.md` and
   `core/IDENTITY.md`.
4. **Records are not rewritten.** Earlier ADRs, logs and the v1.0 and v1.1
   upgrade steps keep the old name; they describe what was true when written.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep "Second Brain OS" | Lost among same-named templates, and "OS" misdescribes it |
| `memvault` | Taken on GitHub and npm, several times by agent memory projects |
| Restart the numbering at memcellar v1.0 | `v1.0` already names a published tag; one tag name would mean two things |

## Consequences

- An existing clone's `template` remote keeps working through the redirect;
  `docs/UPGRADING.md` step 1 shows how to point it at the new name.
- Cost to reverse: low in the files, but every published link and mention
  carries the name from v2.0 on.
