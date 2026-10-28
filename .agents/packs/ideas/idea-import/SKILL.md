---
name: idea-import
description: Audits an external system or design — a repo, an article, a framework, someone else's agent or second-brain setup — against the current one, and adopts only what fills a documented gap, with every rejection recorded and its reason. Use when the owner says "compare this with ours", "what can we take from this", "evaluate this repo/spec against our design", or the same request in the owner's language. Not for bringing an existing notes folder into the vault (that is `import`), and not for scoping a new product idea (product-idea-research).
---

# Idea import

Read the external thing in full, map it against what already exists, and
adopt the *minimal* set of ideas — sometimes exactly one. The default answer
for any given idea is **reject, with a reason**. In the reference instance
this pattern was run on two outside agent designs; each audit adopted one or
two ideas, and the recorded rejections stopped the same ideas being
re-evaluated later.

"The current system" is whatever this session is in: the vault in a vault
session, the repo in a project.

## Method

1. **Inventory the external system on its own terms first.** What problem
   does it think it is solving? What are its load-bearing mechanisms? Don't
   score it yet — misreading it produces junk comparisons. If it is large,
   delegate the raw read-through to a subagent (Claude Code: the Agent tool,
   cheap tier for a pure summary; elsewhere: read it in chunks yourself) and
   keep the judgment. A fetch tool's page summary is not the source: read
   the actual files or page text.
2. **Map each mechanism to the current system:** already have it / have a
   different answer to the same problem / genuinely missing here. "Already
   have it under another name" is the most common case — say so and move on.
3. **For the genuinely missing:** does it fill a gap backed by *evidence* —
   a logged failure, a measured number, a standing open question? No
   documented failure → reject as speculative, however elegant. Growth
   control applies: no new folder, tag, layer, hook or script without an
   actual failure that demands it.
4. **For conflicts:** name the disagreement explicitly and pick a side with a
   reason. A silent conflict is worse than a wrong choice.
5. **Check the frozen constraints** before adopting anything — the current
   system's standing decisions (in this vault: plain Markdown, git as the
   only database, no new machinery without a failure; in a repo: its
   `AGENTS.md` and ADRs). An idea that breaks a constraint is rejected on
   that ground alone and recorded as such. Constraints can be re-litigated,
   but deliberately, as their own decision, never as a side effect of an
   import.

## Output

One dated document with three tables:

- **Adopted** — idea → gap it fills → evidence for the gap (a pointer).
- **Rejected** — idea → reason, one line each. These rows are what stops
  the same idea being re-evaluated next quarter.
- **Conflicts** — their answer vs ours → the call made and why.

Where it goes:

- **Vault session:** through `.agents/write-gate.md` — a `report` in
  `reports/YYYY-MM-DD_<slug>.md` with `source:` (the external system),
  `confidence: low` and `topic:`, plus the line it changes on its topic
  page. Written in the vault's language.
- **Project:** the repo's research store (`reports/research/` when the
  research pack scaffolded one) or `docs/`, in the language of the repo's
  docs. Never the vault (ADR 0052).

Adopted ideas become **proposals** or **ADRs**, never code inside the import
pass. In the vault, `PROPOSALS.md` is kept by the owner by hand: draft the
rows in chat and add them only on the owner's say-so. An adopted idea that is
expensive to reverse becomes an ADR (the `adr` skill when the build pack is
installed). Implementing anything is a later, separate decision.
