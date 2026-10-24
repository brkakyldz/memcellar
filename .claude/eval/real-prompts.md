# Real-prompt retrieval set

`query → expected note` pairs taken from prompts the owner actually typed in
vault sessions, so retrieval is measured against the way they really ask and
not only against the golden set, which whoever built the vault wrote
(`.claude/eval/golden-set.md`). Sibling to it, not part of it:
`node scripts/retrieval-eval.mjs --set real` (or `--set both`) scores it. The
default run scores the golden set only. A missing file, or one with no rows,
is reported as an empty set and scores nothing.

In the reference instance the first scoring of this set came out at roughly
half the golden set's recall: the builder's own questions overstate retrieval.
That gap is the reason the set exists.

**Source.** The vault's own session transcripts. Keep plain text the owner
typed — not a command, hook or task-notification wrapper, not an auto-written
summary, at least 15 characters, no secret-looking string — and fold
near-duplicates; at most five rows per session. Trim each query to the asking
part, one line, the owner's own wording and language, with personal data and
local paths removed. Project sessions are not read (ADR 0052).

**Labels.** `expected` is the one `notes/` or `core/` page that would serve
the prompt, chosen from `INDEX.md` and the head of candidate notes *without*
running the ranker. `—` marks an abstain row: no memory is needed (an
instruction about the current task, a question about the outside world) or
none exists in the searched tiers; abstain rows are counted, never scored. `?`
in the last column means a second note fits equally well; list the one
`INDEX.md` names as the home. A prompt whose only answer lives in `my-notes/`,
`logs/` or `archive/` is not a row, because the ranker searches `notes/` and
`core/` only.

**Never edit a row to make an eval pass.** A failing row is the finding. If the
vault legitimately moved, change `expected`; if the query is no longer
meaningful, delete the row and say so in the session log. Do not add an
`aliases:` line to rescue a query before it has been scored.

The two rows below are format examples, not real prompts — delete them once
you have your own.

| id | query | expected | flag |
|---|---|---|---|
| R-01 | which folders outside the vault am I allowed to read from | notes/source-roots.md |  |
| R-02 | rename the variable in this function to something clearer | — |  |
