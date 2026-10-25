---
id: 0059
title: Vault content is written in the owner's language; the English rule is retired
date: 2026-10-25
status: accepted
amends: [0057]
related: [0055, 0060]
---

# 0059 — Vault content in the owner's language

## Context

`core/IDENTITY.md` told the agent to talk in the owner's language and write
durable content in English. The reason it gave was retrieval: search was
lexical, so a page written with one language's inflections was invisible to a
query typed in the other. `aliases:` was the bridge, and the ranker's eval
measured how well the bridge held.

ADR 0057 retired that machinery. The agent now reads `INDEX.md` and greps.
The rule's one reason went with it. What stayed was the cost: an owner who
thinks and writes in another language reads their own brain in translation.
Their own notes were exempt and lived in a separate folder, which split the
vault in two by language.

## Decision

1. **The vault is written in the owner's language**, the one setup puts in
   `core/IDENTITY.md`. The agent converses and writes in it.
2. **Machine-read names stay as they are:** frontmatter field names, `type:`
   and `status:` values, folder names. Checks read them. Filenames are
   kebab-case in the owner's language, ASCII-folded.
3. **Nothing is translated in bulk.** A page is rewritten in the owner's
   language when it is next updated for its own sake. A reference instance
   that changes language translates its Tier 0 files (`core/`) and its
   one current-truth page at once, because every session reads them.
   Reports, logs and the archive are never translated: they are what was
   written on their date.
4. **Search is in both languages while both exist.** The reading rule greps
   in the language the question came in and in the language older pages are
   written in. `aliases:` is no longer a language bridge; it catches other
   names for the same thing.

## Rationale

- The English rule served one consumer, the lexical ranker, and that consumer
  is gone.
- The owner navigates the vault in Obsidian. Pages in their language are
  pages they read.
- A bulk translation would rewrite hundreds of write-once reports, the one
  kind of page that must stay as it was written.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep English, keep the bridge | It costs the owner every read and buys nothing now |
| Translate everything at once | Rewrites dated records, and the diff would hide every real change of that week |
| Both languages per page | Two copies of one fact, the thing ADR 0055 exists to stop |

## Consequences

- `core/IDENTITY.md` § Language becomes one line. The lesson exception is
  gone: there is no rule to be exempt from.
- `scripts/note-neighbours.mjs` folds both scripts to ASCII already, so a
  query in either language still meets a title in the other.
- A mixed-language vault is the normal state for a long time. A grep that
  misses because the page is in the other language is the cost, paid in
  one extra search.
- Cost to reverse: low for new writes; pages already written stay in
  whatever language they were written in.
