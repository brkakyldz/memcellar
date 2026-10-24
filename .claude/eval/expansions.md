# Query expansions — frozen keyword variants

Input to the `expand` ranker in `scripts/retrieval-eval.mjs`: for a query in
`golden-set.md` (G-NN) or `real-prompts.md` (R-NN), two or three keyword
variants, separated by ` ; `. The ranker runs `fielded` on the original query
and on each variant and fuses the ranked lists by reciprocal rank. This
simulates the query-rewriting step a live `/recall` does before searching —
most useful when you ask in one language and the notes are written in another.

Score it with `node scripts/retrieval-eval.mjs --ranker expand`, or against
the default with `--compare fielded,expand` (add `--set both` to include the
real-prompt set). A row without variants, or a missing file, just falls back
to plain `fielded` for that query.

**How to write them.** Give a fresh model context with no tools and no access
to the vault only the query text and a one-paragraph description of the
vault, and ask for keyword variants without guessing filenames. It must never
see a note, the expected answers or the ranker. Then freeze the rows:
regenerating them until the arm passes would be tuning the test to the answer.

The two rows below match the two example rows of `golden-set.md`; replace them
when you replace those.

| id | variants |
|---|---|
| G-01 | note maturity promotion ; seedling growing evergreen status ; evergreen gate distillation |
| G-02 | deletion rules archive first ; when to delete versus archive ; delete permission approval |
