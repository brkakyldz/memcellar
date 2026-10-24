---
id: 0057
title: The retrieval machinery is retired — the agent reads INDEX.md and the notes; quality is measured by answers, not by a ranker
date: 2026-10-24
status: accepted
reverses: [0010, 0018]
amends: [0020, 0024]
related: [0035, 0055]
---

# 0057 — The retrieval machinery is retired

## Context

ADR 0018 settled retrieval as lexical search plus links plus conventions. It
named a retrieval-failure ledger as the only trigger for revisiting that.
Around it grew a ranker evaluation (`scripts/retrieval-eval.mjs` with
several arms), a golden set, a real-prompt set, frozen query expansions,
and a `/recall` skill that rewrote queries and logged misses.

On 2026-10-24 the reference instance measured how that machinery was used:

- **In real sessions the ranker was almost never called.** Of 106 vault
  sessions, 6 called it, `/recall` was never invoked, and 19 read
  `INDEX.md`.
- **The ledger held almost no real misses.** It had 18 lines: 17 came from
  the August golden-set runs, and 1 from real use.
- **Fresh sessions answered without it.** The same day, fifteen fresh
  sessions each got one question whose answer had changed recently, 13 of
  them traps. None used the ranker or `/recall`. Thirteen found their answer
  with plain `Grep` and `Read`, two answered from the session-start context,
  and 14 of 15 were right.
- **The one wrong answer was not a search miss.** A working rule lived only
  in the vault, while a kit skill still offered the option the rule forbade
  (ADR 0056).

The ranker's recall@3 had climbed to 77% on its own test sets. That number
measured the machinery, not the vault. What had actually gone wrong, in the
weeks before, was stale and duplicated content and a store that typed
nothing (ADR 0055).

## Decision

1. **Removed:**
   - `scripts/retrieval-eval.mjs` and its test;
   - `.claude/eval/golden-set.md`, `real-prompts.md` and `expansions.md`;
   - the `/recall` skill;
   - the `retrieval-failure` signal type, along with every check, count and
     instruction that read one of these.
2. **Reading is a rule, not a skill.** `AGENTS.md` says: when a question may
   already be answered in the vault (a past decision, a person, a project,
   what is true now), read `INDEX.md` and the pages it points to before
   answering. Search with `grep` over `notes/`, `reports/` and `core/`, in
   English and in the language the owner asked in. Cite the page.
3. **Quality is measured by answers.** The eval is a short set of questions
   whose correct answer the owner has confirmed. It lives outside `notes/`,
   so the vault can never read its own answer key (ADR 0055). Each question
   is asked in a fresh session, and the eval records whether the answer was
   right and which pages were read.

## Rationale

- An instrument nobody calls measures nothing about the sessions that
  matter. The machinery was the most complex part of the kit, and the part
  least connected to the failures that actually happened.
- At a few hundred pages, an agent with `grep` and an index finds what is
  there. What it cannot do is tell a current page from a stale one. That is
  a content problem, and ADR 0055 addresses it at write time.
- An answer test catches every failure the owner feels: stale content, a
  missing page, a rule in the wrong home, an agent that never looked.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the eval, drop `/recall` | The eval scored a ranker no session used; keeping it keeps the maintenance, not the value |
| Wire the ranker into session start | Adds machinery to fix a problem the measurement did not show |
| Embeddings | ADR 0018's reasons stand; nothing here argues for them |

## Consequences

- `brain-doctor` loses its `/recall` contract and retrieval-eval checks.
  `maintenance.mjs run` loses its eval step. `vault-metrics` loses its
  ledger counts. The signal ledger keeps its other line types.
- Notes kept only because these files referenced them can be archived.
- Cost to reverse: low. Everything removed is in git history.
