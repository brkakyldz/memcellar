---
name: recall
description: Four-layer lexical retrieval over the vault — search conventions plus a logged retrieval-failure signal when the vault misses. Use in a vault session when the answer may already be in the vault — a past decision, lesson, project or person, or whether an idea was already discussed ("what did we say about X", "is this in the vault") — or when grep alone missed. Not a source of new ideas or recommendations.
---

# Recall

No search index — grep + wikilinks, by design (ADR 0018). Four layers, each
tried before escalating.

## Vault sessions only

This skill lives in the vault's `.agents/skills/` and loads only in a session
opened in the vault. A project session never reads the vault (ADR 0052); the
vault reads a project through `/harvest` instead. Every write it makes — an
alias, a signal line, a golden-set row — lands in the vault. Paths below are
relative to the vault root.

## Layers

1. **Tier 0 — what is actually in context.** `IDENTITY.md`, `USER.md`,
   `MEMORY.md`, injected by the SessionStart hook. `core/OPEN_QUESTIONS.md`
   is **never inlined** — the hook injects a pointer to it, so reading it is a
   tool call like any other file. Check what is in context first; open the
   questions ledger when the query is about live questions or vault planning.

2. **Rank `notes/` + `core/` first**, then use `rg` over `my-notes/` and
   `logs/`. Before ranking, rewrite the question into 2–3 **keyword variants
   in the vault's language** (`core/IDENTITY.md` § Language; 3–7 words each,
   no stopwords): one close translation of its key terms, one with the
   technical term a note would use, optionally one broader. Keep proper names
   as written and do not guess filenames. Then run
   ```
   node scripts/retrieval-eval.mjs --query "<the user's query>" --ranker expand --variant "<v1>" --variant "<v2>" [--variant "<v3>"]
   ```
   It ranks the original and each variant and fuses the lists, by unique
   normalized query-token overlap, so a long report does not win merely by
   repeating a term. In the reference instance, measured against the owner's
   real prompts, this took recall@3 from 33% to 73% (13 wins, 0 losses over
   the plain query): the notes were English and the questions mostly in
   another language, and the rewrite is what bridged that — no stemmer or
   ranking change did. Open only the two or three plausible hits. If the
   ranked lookup returns nothing useful, search titles, `aliases:`, `tags:`
   and body text with `rg`. If the owner converses in a language other than
   the vault's, try the terms in **both** — a lexical index only matches the
   token it was given.

   `my-notes/` is where a question about a **person, company, idea or the
   owner's own opinion** is answered, and it is written in the owner's own
   language. It is flat and classified by `kind:` in frontmatter, so narrow
   with `rg '^kind: person' my-notes/` rather than by path — a name is
   `person` or `org`, "what was I thinking" about a project is `project`. The
   folder is read freely; it is only *written* on the owner's explicit
   request (`/note`).

3. **Wikilink/backlink hops (1–2)** from any hit — `rg` for `[[hit-name]]`
   across the vault to find what links to or from it.

4. **Frontmatter filters** — narrow by `type:`, `status:`, `created:` to cut
   noise once you have candidates.

## On a miss

- **The vault had it and search missed it** (later confirmed in-vault, or a
  query that clearly should have hit): log it **with a cause** —
  ```
  node .claude/hooks/append-signal.mjs retrieval-failure query:"<the query>" cause:paraphrase-miss
  ```
  This ledger is the *only* thing that can ever justify a search index (ADR
  0018) — log every real miss, not just the memorable ones.

  `cause:` is what makes the ledger decidable. Exactly one of:

  | cause | means | what it argues for |
  |---|---|---|
  | `paraphrase-miss` | the note says the same thing in different words — no shared term to grep for | **the only cause that argues for semantic search** |
  | `wrong-term` | the vault uses a term the query didn't (jargon, or the query in another language than the note) | an `aliases:` entry |
  | `typo` | the query or the note was misspelled | nothing — noise |
  | `not-exists` | the vault genuinely never had it | a note worth writing, not a search problem |

  The lexical-only decision reopens on a *cluster of `paraphrase-miss`
  lines*, nothing else. An
  uncaused `retrieval-failure` line is unusable evidence — it can be read as
  arguing for anything, which means it argues for nothing.

- **Vocabulary-shaped miss** (the note existed under a different term than the
  query used): add the missed term to that note's `aliases:` frontmatter.
  `notes/` isn't protected, so this direct edit is allowed — just mention it
  in one line to the owner ("added alias X to notes/Y.md"). Never add one to
  a file in `my-notes/` unasked.

- A write above is committed by explicit path
  (`git commit -m "<what>" -- <path>`), after checking `git diff -- <path>`
  shows only your change. Never push.

## Golden set

`.claude/eval/golden-set.md` holds `query → expected note` pairs;
`node scripts/retrieval-eval.mjs` re-runs them and reports recall@k. Add a row
whenever a real lookup teaches you a query shape worth defending — especially
right after a miss you just fixed with an alias, so the fix stays fixed.

An optional held-out sibling, `.claude/eval/real-prompts.md`, holds prompts the
owner actually typed, labeled separately; `.claude/eval/expansions.md` holds the
frozen variants the `expand` ranker is measured with. Once they exist, a
ranking or skill change is adopted only when
`node scripts/retrieval-eval.mjs --compare <baseline>,<candidate> --set both`
says it passes the sign-test gate.
