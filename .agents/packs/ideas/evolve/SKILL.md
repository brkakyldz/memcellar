---
name: evolve
description: Runs a structured evolution pass over a system the owner keeps — this vault or a project — a full self-analysis plus fanned-out outside research, returning ranked proposals tied to documented failures, with nothing applied. Use when the owner says "analyse the system and find ideas to move it forward", "how can we improve this", "give me a roadmap", or the same request in the owner's language. Not for auditing one external system against ours (idea-import) or scoping a new product (product-idea-research).
---

# Evolve

The output is a proposals document; applying anything is a later, separate
decision. "The system" is whatever this session is in: the vault in a vault
session, the repo in a project.

## Method

1. **Read the system's own claims first** — its constitution (`AGENTS.md`),
   its decisions (ADRs), open questions, declared metrics, current state.
   The strongest proposals fix a gap the system *already admits to*: a
   declared metric nothing measures, an open question with no
   instrumentation, a policy with no mechanism behind it.
2. **Fan research out, keep the judgment.** Three or four research legs on
   genuinely different angles — the state of the art, comparable systems in
   practice, the platform's current capabilities, the specific weak area.
   If the research pack is installed, run them through `research`;
   otherwise run the searches directly with the same report shape. Claude
   Code fans out with subagents (cheap tier for pure lookups); elsewhere run
   the legs one after another. Cross-check every load-bearing external claim
   before it enters the document, and flag unverified ones inline.
3. **Grade every candidate against evidence.** Each proposal names the
   measured failure, logged signal or admitted gap it fixes. "The research
   says it's good" is not a reason. In the reference instance, a full pass
   of this kind mostly *validated* the existing design, and the honest
   verdict said so: expect and welcome that outcome — a short list beats a
   padded one.
4. **Respect frozen constraints.** A proposal that breaks a standing
   constraint (in this vault: plain Markdown, git as the only database, no
   new folder, hook or script without an actual failure; in a repo: its
   `AGENTS.md` and ADRs) goes in a separate "requires re-litigating a
   constraint" section — never mixed in as if it were free.
5. **Rank by how directly each item fixes a documented failure,** then by
   cost. Tier the list — do now / do when triggered / rejected with reason —
   so the rejected ideas are not re-researched next quarter.

Any cost a proposal carries (a paid service, a subscription, compute) is
stated with its amount; nothing is bought or turned on by this pass.

## Output

One dated proposals document, opening with "Proposals only — nothing here
has been applied", the method line (which legs ran, what was cross-checked)
and a one-paragraph verdict. Each proposal: what → the failure it fixes (with
a pointer) → cost → trigger or kill criterion.

Where it goes:

- **Vault session:** through `.agents/write-gate.md` — a `report` in
  `reports/YYYY-MM-DD_<slug>.md` with `source:` (the research legs),
  `confidence: low` and `topic:`, plus its line on the topic page. Written in
  the vault's language.
- **Project:** the repo's research store (`reports/research/` when the
  research pack scaffolded one) or `docs/`, in the language of the repo's
  docs. Never the vault (ADR 0052).

Top-tier items become proposals or ADRs. In the vault, `PROPOSALS.md` is kept
by the owner by hand: draft its rows in chat and add them only on the owner's
say-so. A proposal that is expensive to reverse, once accepted, becomes an
ADR (the `adr` skill when the build pack is installed).
